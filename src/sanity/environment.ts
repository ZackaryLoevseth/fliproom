export type SanityEnvironment = {
  NEXT_PUBLIC_SANITY_PROJECT_ID?: string;
  NEXT_PUBLIC_SANITY_DATASET?: string;
  SANITY_ROOM_KEY?: string;
};

export type SanitySettings =
  | { status: 'unconfigured' }
  | { status: 'invalid'; error: string }
  | { status: 'configured'; projectId: string; dataset: string; roomKey?: string };

export function readSanitySettings(env: SanityEnvironment): SanitySettings {
  const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = env.NEXT_PUBLIC_SANITY_DATASET?.trim();
  const roomKey = env.SANITY_ROOM_KEY?.trim();
  if (!projectId && !dataset && !roomKey) return { status: 'unconfigured' };
  if (!projectId || !dataset) {
    return { status: 'invalid', error: 'Set both NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET to connect Sanity.' };
  }
  if (!/^[a-z0-9]+$/.test(projectId) || !/^[a-z0-9][a-z0-9_-]*$/.test(dataset)) {
    return { status: 'invalid', error: 'The Sanity project ID or dataset name has an invalid format.' };
  }
  return { status: 'configured', projectId, dataset, roomKey };
}

export function currentSanityEnvironment(): SanityEnvironment {
  return {
    NEXT_PUBLIC_SANITY_PROJECT_ID: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    NEXT_PUBLIC_SANITY_DATASET: process.env.NEXT_PUBLIC_SANITY_DATASET,
    SANITY_ROOM_KEY: process.env.SANITY_ROOM_KEY,
  };
}
