import { APP_CONFIG, AppResource } from "@stellartools/app-embed-bridge";

export const getResourceForEvent = (eventType: string): AppResource | undefined => {
  return (Object.keys(APP_CONFIG) as AppResource[]).find((key) =>
    (APP_CONFIG[key].events as readonly string[]).includes(eventType)
  );
};
