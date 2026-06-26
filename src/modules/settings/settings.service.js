import Settings from "./settings.model.js";

const SETTINGS_KEY = "marketplace";

const normalizeSettingsPayload = (payload = {}) => ({
  ...payload,
  key: SETTINGS_KEY,
});

export const getSettings = async () => {
  let settings = await Settings.findOne({ key: SETTINGS_KEY }).lean();

  if (!settings) {
    settings = await Settings.create(normalizeSettingsPayload({}));
  }

  return settings;
};

export const updateSettings = async (payload) => {
  const normalizedPayload = normalizeSettingsPayload(payload);

  let settings = await Settings.findOne({ key: SETTINGS_KEY });

  if (!settings) {
    settings = await Settings.create(normalizedPayload);
    return settings.toObject();
  }

  Object.assign(settings, normalizedPayload);
  await settings.save();
  return settings.toObject();
};
