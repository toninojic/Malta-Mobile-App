const { withAndroidManifest } = require('@expo/config-plugins');

const BROWSER_QUERY_INTENTS = [
  {
    action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    data: [{ $: { 'android:scheme': 'http' } }],
  },
  {
    action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    data: [{ $: { 'android:scheme': 'https' } }],
  },
  {
    action: [{ $: { 'android:name': 'android.support.customtabs.action.CustomTabsService' } }],
  },
];

module.exports = function withAndroidBrowserQueries(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    const manifest = configWithManifest.modResults.manifest;
    manifest.queries = manifest.queries ?? [{}];

    const queryBlock = manifest.queries[0];
    queryBlock.intent = queryBlock.intent ?? [];

    for (const intent of BROWSER_QUERY_INTENTS) {
      if (!hasIntent(queryBlock.intent, intent)) {
        queryBlock.intent.push(intent);
      }
    }

    return configWithManifest;
  });
};

function hasIntent(existingIntents, nextIntent) {
  const nextAction = nextIntent.action?.[0]?.$?.['android:name'];
  const nextScheme = nextIntent.data?.[0]?.$?.['android:scheme'] ?? null;

  return existingIntents.some((intent) => {
    const action = intent.action?.[0]?.$?.['android:name'];
    const scheme = intent.data?.[0]?.$?.['android:scheme'] ?? null;
    return action === nextAction && scheme === nextScheme;
  });
}
