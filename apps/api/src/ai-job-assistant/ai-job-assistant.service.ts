import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiConversation,
  AiConversationStatus,
  AiJobDraft,
  AiJobDraftStatus,
  AiMessage,
  AiMessageRole,
  UserRole,
} from '@prisma/client';
import { MALTA_SERVICE_LOCATIONS, normalizeLocationKey, serviceLocationLabel } from '../common/malta-locations';
import { SERVICE_CATEGORIES, assertValidServiceCategory } from '../common/service-categories';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { SendAiMessageDto } from './dto/send-ai-message.dto';

type ConversationWithDraftAndMessages = AiConversation & {
  draft: AiJobDraft | null;
  messages: AiMessage[];
};

type NormalizedDraft = {
  title: string;
  description: string;
  categoryKey: string;
  subcategoryKey: string;
  locationKey: string;
};

type AiModelResult = {
  assistantMessage: string;
  draft: NormalizedDraft | null;
};

const UNAVAILABLE_MESSAGE = 'AI assistant is currently unavailable.';
const DAILY_LIMIT_FALLBACK = 20;
const OPENAI_MODEL_FALLBACK = 'gpt-4o-mini';

@Injectable()
export class AiJobAssistantService {
  private readonly logger = new Logger(AiJobAssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jobsService: JobsService,
  ) {}

  async createConversation(user: AuthenticatedUser) {
    this.assertEmployerOnly(user);

    const conversation =
      (await this.findActiveConversation(user.id)) ??
      (await this.prisma.aiConversation.create({
        data: { employerId: user.id },
        include: this.conversationInclude(),
      }));

    return this.toConversationResponse(user.id, conversation);
  }

  async currentConversation(user: AuthenticatedUser) {
    this.assertEmployerOnly(user);
    const conversation = await this.findActiveConversation(user.id);
    return this.toConversationResponse(user.id, conversation);
  }

  async usage(user: AuthenticatedUser) {
    this.assertEmployerOnly(user);
    return this.getUsageSnapshot(user.id);
  }

  async sendMessage(user: AuthenticatedUser, dto: SendAiMessageDto) {
    this.assertEmployerOnly(user);

    if (!this.isAiAvailable()) {
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }

    const conversation = await this.prisma.aiConversation.findFirst({
      where: {
        id: dto.conversationId,
        employerId: user.id,
        status: AiConversationStatus.ACTIVE,
      },
      include: this.conversationInclude(),
    });

    if (!conversation) {
      throw new NotFoundException('AI conversation not found.');
    }

    await this.reserveDailyMessage(user.id);

    await this.prisma.$transaction([
      this.prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: AiMessageRole.USER,
          content: dto.message,
        },
      }),
      this.prisma.aiConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    const latestConversation = await this.prisma.aiConversation.findUniqueOrThrow({
      where: { id: conversation.id },
      include: this.conversationInclude(),
    });
    const aiResult = await this.generateAssistantReply(latestConversation);

    const assistantMessage = await this.prisma.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: AiMessageRole.ASSISTANT,
        content: aiResult.assistantMessage,
      },
    });

    const draft = aiResult.draft
      ? await this.prisma.aiJobDraft.upsert({
          where: { conversationId: conversation.id },
          create: {
            conversationId: conversation.id,
            employerId: user.id,
            ...aiResult.draft,
          },
          update: {
            ...aiResult.draft,
            status: AiJobDraftStatus.DRAFT,
          },
        })
      : latestConversation.draft;

    const usage = await this.getUsageSnapshot(user.id);

    return {
      assistantMessage: assistantMessage.content,
      draft: draft ? this.toDraft(draft) : null,
      remainingMessages: usage.remainingMessages,
      usage,
    };
  }

  async publishDraft(user: AuthenticatedUser, draftId: string) {
    this.assertEmployerOnly(user);

    const draft = await this.prisma.aiJobDraft.findFirst({
      where: {
        id: draftId,
        employerId: user.id,
        status: AiJobDraftStatus.DRAFT,
      },
    });

    if (!draft) {
      throw new NotFoundException('AI job draft not found.');
    }

    assertValidServiceCategory(draft.categoryKey, draft.subcategoryKey);
    if (!MALTA_SERVICE_LOCATIONS.some((location) => location.key === draft.locationKey)) {
      throw new BadRequestException('Draft location is not valid.');
    }

    const job = await this.jobsService.create(user, {
      title: draft.title,
      description: draft.description,
      category: draft.categoryKey,
      subcategory: draft.subcategoryKey,
      location: serviceLocationLabel(draft.locationKey),
      imageUrls: [],
      imageKeys: [],
    });

    const updatedDraft = await this.prisma.aiJobDraft.update({
      where: { id: draft.id },
      data: {
        status: AiJobDraftStatus.PUBLISHED,
        publishedJobId: job.id,
        conversation: {
          update: { status: AiConversationStatus.COMPLETED },
        },
      },
    });

    return {
      job,
      draft: this.toDraft(updatedDraft),
    };
  }

  async discardDraft(user: AuthenticatedUser, draftId: string) {
    this.assertEmployerOnly(user);

    const draft = await this.prisma.aiJobDraft.findFirst({
      where: {
        id: draftId,
        employerId: user.id,
        status: AiJobDraftStatus.DRAFT,
      },
    });

    if (!draft) {
      throw new NotFoundException('AI job draft not found.');
    }

    const updatedDraft = await this.prisma.aiJobDraft.update({
      where: { id: draft.id },
      data: {
        status: AiJobDraftStatus.DISCARDED,
        conversation: {
          update: { status: AiConversationStatus.DISCARDED },
        },
      },
    });

    return {
      success: true,
      draft: this.toDraft(updatedDraft),
    };
  }

  private async generateAssistantReply(conversation: ConversationWithDraftAndMessages): Promise<AiModelResult> {
    if (this.useMockOpenAi()) {
      return this.generateMockReply(conversation);
    }

    const apiKey = this.openAiApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.get<string>('OPENAI_MODEL')?.trim() || OPENAI_MODEL_FALLBACK,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: this.toOpenAiMessages(conversation),
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        this.logger.warn(`OpenAI request failed with ${response.status}`);
        throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
      }

      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
      }

      return this.parseAiContent(content);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      this.logger.warn(`AI assistant failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
  }

  private parseAiContent(content: string): AiModelResult {
    const parsed = JSON.parse(content) as {
      assistantMessage?: unknown;
      draft?: unknown;
    };
    const assistantMessage =
      typeof parsed.assistantMessage === 'string' && parsed.assistantMessage.trim()
        ? parsed.assistantMessage.trim()
        : 'I can help turn that into a job draft. Could you share a little more detail?';

    return {
      assistantMessage: this.stripContactDetails(assistantMessage).slice(0, 1000),
      draft: this.normalizeDraft(parsed.draft),
    };
  }

  private toOpenAiMessages(conversation: ConversationWithDraftAndMessages) {
    const allowedCategories = SERVICE_CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
      subcategories: category.subcategories,
    }));
    const locations = MALTA_SERVICE_LOCATIONS;

    return [
      {
        role: 'system',
        content: [
          'You are MaltaPro AI Job Assistant.',
          'You only help employers create MaltaPro job requests.',
          'If the user asks unrelated questions, reply exactly: I can only help you create a job request for MaltaPro.',
          'Ask follow-up questions if title, description, category, subcategory, or location are missing or unclear.',
          'Use only the allowed category keys and subcategory keys.',
          'Use only the allowed Malta location keys.',
          'Never include contact details, phone numbers, emails, URLs, social links, prices, budgets, urgency scores, or contractor recommendations.',
          'When enough information exists, return a JSON object with assistantMessage and draft.',
          'draft must be null until all required fields are clear.',
          `Allowed categories JSON: ${JSON.stringify(allowedCategories)}`,
          `Allowed locations JSON: ${JSON.stringify(locations)}`,
          conversation.draft ? `Current draft JSON: ${JSON.stringify(this.toDraft(conversation.draft))}` : 'Current draft JSON: null',
          'Response format: {"assistantMessage":"string","draft":{"title":"string","description":"string","categoryKey":"string","subcategoryKey":"string","locationKey":"string"} | null}',
        ].join('\n'),
      },
      ...conversation.messages.slice(-12).map((message) => ({
        role: message.role === AiMessageRole.USER ? 'user' : 'assistant',
        content: message.content,
      })),
    ];
  }

  private generateMockReply(conversation: ConversationWithDraftAndMessages): AiModelResult {
    const userMessages = conversation.messages.filter((message) => message.role === AiMessageRole.USER);
    const latest = userMessages.at(-1)?.content ?? '';
    const combined = userMessages.map((message) => message.content).join(' ');
    const category = this.inferCategory(combined);
    const location = this.inferLocation(combined);

    if (/weather|football|recipe|politics/i.test(latest)) {
      return {
        assistantMessage: 'I can only help you create a job request for MaltaPro.',
        draft: null,
      };
    }

    if (!category) {
      return {
        assistantMessage: 'Is this a plumbing, electrical, painting, handyman, or another type of job?',
        draft: null,
      };
    }

    if (!location) {
      return {
        assistantMessage: 'Which area in Malta is this job located in?',
        draft: null,
      };
    }

    const title = this.titleFromText(combined, category);
    const description = this.descriptionFromText(combined);
    return {
      assistantMessage: 'I created a structured job draft. Please review it before publishing.',
      draft: {
        title,
        description,
        categoryKey: category.categoryKey,
        subcategoryKey: category.subcategoryKey,
        locationKey: location.key,
      },
    };
  }

  private normalizeDraft(value: unknown): NormalizedDraft | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const raw = value as Record<string, unknown>;
    const title = this.cleanText(raw.title, 160);
    const description = this.cleanText(raw.description, 4000);
    const category = this.findCategory(String(raw.categoryKey ?? raw.category ?? ''));
    const subcategory = category
      ? this.findSubcategory(category.categoryKey, String(raw.subcategoryKey ?? raw.subcategory ?? ''))
      : null;
    const location = this.findLocation(String(raw.locationKey ?? raw.location ?? ''));

    if (!title || title.length < 5 || !description || description.length < 20 || !category || !subcategory || !location) {
      return null;
    }

    return {
      title,
      description,
      categoryKey: category.categoryKey,
      subcategoryKey: subcategory.subcategoryKey,
      locationKey: location.key,
    };
  }

  private cleanText(value: unknown, maxLength: number) {
    if (typeof value !== 'string') {
      return '';
    }

    return this.stripContactDetails(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  private stripContactDetails(value: string) {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[contact removed]')
      .replace(/https?:\/\/\S+|www\.\S+/gi, '[link removed]')
      .replace(/(?:\+?\d[\s().-]*){7,}/g, '[phone removed]');
  }

  private inferCategory(text: string) {
    const lower = text.toLowerCase();
    const candidates: Array<{ pattern: RegExp; categoryKey: string; subcategoryKey: string }> = [
      { pattern: /pipe|leak|plumb|bathroom|toilet|sink|drain/, categoryKey: 'plumbing', subcategoryKey: 'pipe_installation' },
      { pattern: /socket|switch|light|wire|electric|fuse/, categoryKey: 'electrical', subcategoryKey: 'wiring' },
      { pattern: /paint|wall color|colour|ceiling/, categoryKey: 'painting', subcategoryKey: 'interior_painting' },
      { pattern: /tile|renovat|plaster|floor|building/, categoryKey: 'construction', subcategoryKey: 'home_renovation' },
      { pattern: /clean|deep clean|window/, categoryKey: 'cleaning', subcategoryKey: 'home_cleaning' },
      { pattern: /handyman|mount|assemble|repair shelf|maintenance/, categoryKey: 'handyman', subcategoryKey: 'general_repairs' },
      { pattern: /ac|air condition|heating/, categoryKey: 'ac_heating', subcategoryKey: 'ac_service' },
      { pattern: /carpenter|wood|door|wardrobe|cabinet/, categoryKey: 'carpentry', subcategoryKey: 'wood_repairs' },
      { pattern: /garden|tree|landscap|irrigation/, categoryKey: 'gardening', subcategoryKey: 'garden_maintenance' },
      { pattern: /washing machine|dishwasher|oven|fridge|dryer|appliance/, categoryKey: 'appliance_repair', subcategoryKey: 'washing_machine' },
      { pattern: /lock|key/, categoryKey: 'locksmith', subcategoryKey: 'lock_repair' },
      { pattern: /move|delivery|furniture delivery|packing/, categoryKey: 'moving_delivery', subcategoryKey: 'small_moves' },
      { pattern: /pest|insect|rodent/, categoryKey: 'pest_control', subcategoryKey: 'general_pest_control' },
      { pattern: /solar|energy/, categoryKey: 'solar_energy', subcategoryKey: 'solar_maintenance' },
    ];

    return candidates.find((candidate) => candidate.pattern.test(lower)) ?? null;
  }

  private inferLocation(text: string) {
    const normalized = normalizeLocationKey(text);
    return MALTA_SERVICE_LOCATIONS.find((location) => normalized.includes(location.key)) ?? null;
  }

  private titleFromText(text: string, category: { categoryKey: string; subcategoryKey: string }) {
    const categoryLabel = SERVICE_CATEGORIES.find((item) => item.key === category.categoryKey)?.label ?? 'Job';
    const location = this.inferLocation(text);
    const title = `${categoryLabel} job${location ? ` in ${location.label}` : ''}`;
    return title.slice(0, 160);
  }

  private descriptionFromText(text: string) {
    const cleaned = this.cleanText(text, 700);
    if (cleaned.length >= 20) {
      return cleaned;
    }

    return 'Please review this AI generated job draft and add any extra details before publishing.';
  }

  private findCategory(input: string) {
    const normalized = normalizeKeyLike(input);
    const category = SERVICE_CATEGORIES.find(
      (item) => item.key === normalized || normalizeKeyLike(item.label) === normalized,
    );

    return category ? { categoryKey: category.key } : null;
  }

  private findSubcategory(categoryKey: string, input: string) {
    const normalized = normalizeKeyLike(input);
    const category = SERVICE_CATEGORIES.find((item) => item.key === categoryKey);
    const subcategory = category?.subcategories.find(
      (item) => item.key === normalized || normalizeKeyLike(item.label) === normalized,
    );

    return subcategory ? { subcategoryKey: subcategory.key } : null;
  }

  private findLocation(input: string) {
    const key = normalizeLocationKey(input);
    return MALTA_SERVICE_LOCATIONS.find((location) => location.key === key || normalizeKeyLike(location.label) === key) ?? null;
  }

  private async reserveDailyMessage(userId: string) {
    const dateUtc = todayUtcDate();
    const limit = this.dailyLimit();
    const current = await this.prisma.aiUsage.findUnique({
      where: {
        userId_dateUtc: { userId, dateUtc },
      },
    });

    if ((current?.userMessageCount ?? 0) >= limit) {
      throw new HttpException(
        'You have used your AI messages for today. You can create a job manually or try again tomorrow.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.aiUsage.upsert({
      where: {
        userId_dateUtc: { userId, dateUtc },
      },
      create: {
        userId,
        dateUtc,
        userMessageCount: 1,
      },
      update: {
        userMessageCount: { increment: 1 },
      },
    });
  }

  private async getUsageSnapshot(userId: string) {
    const dateUtc = todayUtcDate();
    const usage = await this.prisma.aiUsage.findUnique({
      where: {
        userId_dateUtc: { userId, dateUtc },
      },
    });
    const limit = this.dailyLimit();
    const usedMessages = usage?.userMessageCount ?? 0;

    return {
      limit,
      usedMessages,
      remainingMessages: Math.max(limit - usedMessages, 0),
      dateUtc: dateUtc.toISOString().slice(0, 10),
    };
  }

  private async toConversationResponse(userId: string, conversation: ConversationWithDraftAndMessages | null) {
    const usage = await this.getUsageSnapshot(userId);

    return {
      isAvailable: this.isAiAvailable(),
      unavailableReason: this.isAiAvailable() ? null : UNAVAILABLE_MESSAGE,
      conversation: conversation
        ? {
            id: conversation.id,
            employerId: conversation.employerId,
            status: conversation.status,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
          }
        : null,
      messages: conversation?.messages.map((message) => this.toMessage(message)) ?? [],
      draft: conversation?.draft ? this.toDraft(conversation.draft) : null,
      usage,
      remainingMessages: usage.remainingMessages,
    };
  }

  private findActiveConversation(employerId: string) {
    return this.prisma.aiConversation.findFirst({
      where: {
        employerId,
        status: AiConversationStatus.ACTIVE,
      },
      include: this.conversationInclude(),
      orderBy: { updatedAt: 'desc' },
    });
  }

  private conversationInclude() {
    return {
      draft: true,
      messages: {
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }

  private toMessage(message: AiMessage) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    };
  }

  private toDraft(draft: AiJobDraft) {
    return {
      id: draft.id,
      conversationId: draft.conversationId,
      employerId: draft.employerId,
      title: draft.title,
      description: draft.description,
      categoryKey: draft.categoryKey,
      subcategoryKey: draft.subcategoryKey,
      locationKey: draft.locationKey,
      status: draft.status,
      publishedJobId: draft.publishedJobId,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }

  private assertEmployerOnly(user: AuthenticatedUser) {
    if (user.role !== UserRole.EMPLOYER) {
      throw new ForbiddenException('Only employers can use AI Job Assistant.');
    }
  }

  private dailyLimit() {
    const value = Number(this.config.get<string>('AI_DAILY_MESSAGE_LIMIT') ?? DAILY_LIMIT_FALLBACK);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : DAILY_LIMIT_FALLBACK;
  }

  private isAiAvailable() {
    return this.useMockOpenAi() || Boolean(this.openAiApiKey());
  }

  private useMockOpenAi() {
    return parseBoolean(this.config.get<string>('AI_ASSISTANT_MOCK'));
  }

  private openAiApiKey() {
    const value = this.config.get<string>('OPENAI_API_KEY')?.trim();
    return value || null;
  }
}

function todayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function normalizeKeyLike(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseBoolean(value: string | undefined) {
  return ['true', '1', 'yes', 'on'].includes(String(value ?? '').trim().replace(/^['"]|['"]$/g, '').toLowerCase());
}
