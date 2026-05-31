import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

for (const envFile of ['.env', 'apps/api/.env', '../../.env']) {
  const envPath = resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api/v1';
const suffix = Date.now();
const prisma = new PrismaClient();

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function expectStatus(label, status, fn) {
  try {
    await fn();
  } catch (error) {
    if (String(error.message).includes(String(status))) {
      console.info(`OK ${label}`);
      return;
    }

    throw error;
  }

  throw new Error(`${label} should have returned ${status}.`);
}

async function register(role, label) {
  return request('/auth/register', {
    method: 'POST',
    body: {
      email: `m5.${label}.${suffix}@malta.test`,
      password: 'Password123!',
      role,
      displayName: `Milestone 5 ${label}`,
      phone: '+356 9900 5555',
      location: 'Malta',
      companyName: role === 'CONTRACTOR' ? `M5 ${label} Trades` : undefined,
      tradeCategories: role === 'CONTRACTOR' ? ['Electrical'] : undefined,
    },
  });
}

async function createJob(employerSession, label) {
  return request('/jobs', {
    method: 'POST',
    token: employerSession.accessToken,
    body: {
      title: `Milestone 5 ${label} job`,
      description: 'Smoke test job for messaging and notification workflows.',
      category: 'electrical',
      subcategory: 'repairs',
      location: 'Sliema, Malta',
      imageUrls: [],
    },
  });
}

async function createOffer(contractorSession, jobId, price = 140) {
  return request(`/jobs/${jobId}/offers`, {
    method: 'POST',
    token: contractorSession.accessToken,
    body: {
      estimatedPrice: price,
      estimatedCompletionDays: 2,
      message: 'Available this week for the work.',
    },
  });
}

async function buyStarterTokens(contractorSession) {
  const packages = await request('/tokens/packages', { token: contractorSession.accessToken });
  const starter = packages.find((tokenPackage) => tokenPackage.title === 'Starter') ?? packages[0];
  if (!starter) {
    throw new Error('No active token package available for messaging smoke test.');
  }

  return request('/tokens/mock-purchase', {
    method: 'POST',
    token: contractorSession.accessToken,
    body: { tokenPackageId: starter.id },
  });
}

function findNotification(notifications, type, metadataKey, metadataValue) {
  return notifications.data.find(
    (notification) =>
      notification.type === type &&
      notification.metadata &&
      notification.metadata[metadataKey] === metadataValue,
  );
}

async function main() {
  const employer = await register('EMPLOYER', 'employer');
  const contractor = await register('CONTRACTOR', 'contractor');
  const otherEmployer = await register('EMPLOYER', 'other.employer');
  const otherContractor = await register('CONTRACTOR', 'other.contractor');
  const admin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@malta.test', password: 'Password123!' },
  });

  const job = await createJob(employer, 'primary');
  const offer = await createOffer(contractor, job.id);

  const pendingContact = await request(`/offers/${offer.id}/request-contact`, {
    method: 'POST',
    token: employer.accessToken,
  });

  await expectStatus('messaging is blocked before contact unlock', 403, () =>
    request(`/conversations/${pendingContact.contactId}/messages`, {
      method: 'POST',
      token: employer.accessToken,
      body: { content: 'This message should not be allowed yet.' },
    }),
  );

  await buyStarterTokens(contractor);
  const unlock = await request(`/offers/${offer.id}/unlock`, {
    method: 'POST',
    token: contractor.accessToken,
  });
  const contact = unlock.contact;
  console.info('OK contact unlock completed');

  const employerNotificationsAfterUnlock = await request('/notifications?limit=50', {
    token: employer.accessToken,
  });
  const contactNotification = findNotification(
    employerNotificationsAfterUnlock,
    'CONTACT_UNLOCKED',
    'contactId',
    contact.id,
  );
  if (!contactNotification || contactNotification.isRead) {
    throw new Error('Contact unlocked notification was not created as unread.');
  }
  console.info('OK contact unlocked notification is created');

  const firstSend = await request(`/conversations/${contact.id}/messages`, {
    method: 'POST',
    token: employer.accessToken,
    body: { content: 'Hello, can you visit tomorrow morning?' },
  });
  if (firstSend.conversation.contactUnlockId !== contact.id || firstSend.message.senderId !== employer.user.id) {
    throw new Error('First message did not create the expected conversation.');
  }
  const conversationId = firstSend.conversation.id;
  console.info('OK conversation is created on first message');
  console.info('OK employer can send message after unlock');

  const contractorNotifications = await request('/notifications?limit=50', {
    token: contractor.accessToken,
  });
  const newMessageNotification = findNotification(
    contractorNotifications,
    'NEW_MESSAGE',
    'messageId',
    firstSend.message.id,
  );
  if (!newMessageNotification || newMessageNotification.isRead) {
    throw new Error('New message notification was not created as unread.');
  }
  console.info('OK new message notification is created');

  const contractorUnreadBeforeRead = await request('/notifications/unread-count', {
    token: contractor.accessToken,
  });
  if (contractorUnreadBeforeRead.count < 1) {
    throw new Error('Unread notification count did not include new message.');
  }
  console.info('OK notification unread count updates');

  const readNotification = await request(`/notifications/${newMessageNotification.id}/read`, {
    method: 'PATCH',
    token: contractor.accessToken,
  });
  if (!readNotification.isRead || !readNotification.readAt) {
    throw new Error('Notification read update did not persist.');
  }
  console.info('OK notification read update works');

  await request('/notifications/read-all', {
    method: 'PATCH',
    token: contractor.accessToken,
  });
  const contractorUnreadAfterReadAll = await request('/notifications/unread-count', {
    token: contractor.accessToken,
  });
  if (contractorUnreadAfterReadAll.count !== 0) {
    throw new Error('Mark all notifications read did not clear unread count.');
  }
  console.info('OK mark all notifications read works');

  const secondSend = await request(`/conversations/${contact.id}/messages`, {
    method: 'POST',
    token: contractor.accessToken,
    body: { content: 'Yes, I can come at 9 AM.' },
  });
  if (secondSend.conversation.id !== conversationId || secondSend.message.senderId !== contractor.user.id) {
    throw new Error('Second message did not reuse the existing conversation.');
  }

  const duplicateCount = await prisma.conversation.count({
    where: { contactUnlockId: contact.id },
  });
  if (duplicateCount !== 1) {
    throw new Error(`Expected one conversation for contact unlock, found ${duplicateCount}.`);
  }
  console.info('OK duplicate conversation prevention works');
  console.info('OK contractor can send message after unlock');

  const employerConversations = await request('/conversations?limit=50', {
    token: employer.accessToken,
  });
  const employerConversation = employerConversations.data.find((conversation) => conversation.id === conversationId);
  if (!employerConversation || employerConversation.unreadCount < 1 || !employerConversation.lastMessage) {
    throw new Error('Conversation list did not include last message preview and unread count.');
  }
  console.info('OK conversation list includes preview and unread count');

  const messagesForContractor = await request(`/conversations/${conversationId}/messages`, {
    token: contractor.accessToken,
  });
  if (
    messagesForContractor.length !== 2 ||
    messagesForContractor[0].id !== firstSend.message.id ||
    messagesForContractor[1].id !== secondSend.message.id
  ) {
    throw new Error('Message history was not returned in ascending order.');
  }
  console.info('OK message retrieval returns ascending history');

  const readMessage = await request(`/messages/${firstSend.message.id}/read`, {
    method: 'PATCH',
    token: contractor.accessToken,
  });
  if (!readMessage.isRead) {
    throw new Error('Message read status did not persist.');
  }
  console.info('OK message read status update works');

  await expectStatus('sender cannot mark own message as read', 403, () =>
    request(`/messages/${firstSend.message.id}/read`, {
      method: 'PATCH',
      token: employer.accessToken,
    }),
  );

  await expectStatus('other employer cannot view conversation', 403, () =>
    request(`/conversations/${conversationId}`, {
      token: otherEmployer.accessToken,
    }),
  );

  await expectStatus('other contractor cannot send into conversation', 403, () =>
    request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: otherContractor.accessToken,
      body: { content: 'Unauthorized message.' },
    }),
  );

  await expectStatus('admin cannot send participant messages', 403, () =>
    request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: admin.accessToken,
      body: { content: 'Admin should be read-only in conversations.' },
    }),
  );
  console.info('OK authorization protects conversations');

  await request(`/messages/${secondSend.message.id}/read`, {
    method: 'PATCH',
    token: employer.accessToken,
  });
  const employerConversationsAfterRead = await request('/conversations?limit=50', {
    token: employer.accessToken,
  });
  const readConversation = employerConversationsAfterRead.data.find((conversation) => conversation.id === conversationId);
  if (!readConversation || readConversation.unreadCount !== 0) {
    throw new Error('Conversation unread count did not clear after message read.');
  }
  console.info('OK conversation unread count clears after read');

  const adminConversations = await request('/admin/conversations?limit=100', {
    token: admin.accessToken,
  });
  if (!adminConversations.data.some((conversation) => conversation.id === conversationId)) {
    throw new Error('Admin conversation list did not include the conversation.');
  }

  const adminConversation = await request(`/admin/conversations/${conversationId}`, {
    token: admin.accessToken,
  });
  if (!adminConversation.messages || adminConversation.messages.length < 2) {
    throw new Error('Admin conversation details did not include message history.');
  }
  console.info('OK admin can view conversations and messages');

  const adminNotifications = await request('/admin/notifications?limit=100', {
    token: admin.accessToken,
  });
  if (
    !findNotification(adminNotifications, 'CONTACT_UNLOCKED', 'contactId', contact.id) ||
    !findNotification(adminNotifications, 'NEW_MESSAGE', 'messageId', firstSend.message.id)
  ) {
    throw new Error('Admin notifications did not include messaging workflow notifications.');
  }
  console.info('OK admin can view notifications');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
