export type MixinProps<Mixin extends string, Props> = {
  [Key in keyof Props as `${Mixin}${Capitalize<Key & string>}`]: Props[Key];
};

type SplitProps<Props, Mixins extends string[]> = {
  [Mixin in Mixins[number]]: {
    [MixinKey in keyof Props as MixinKey extends `${Mixin}${infer Key}` ? Uncapitalize<Key> : never]: Props[MixinKey];
  };
} & {
  rest: Omit<
    Props,
    {
      [Mixin in Mixins[number]]: keyof {
        [MixinKey in keyof Props as MixinKey extends `${Mixin}${string}` ? MixinKey : never]: never;
      };
    }[Mixins[number]]
  >;
};

export const splitProps = <Props, Mixins extends string[]>(
  props: Props,
  ...mixins: Mixins
): SplitProps<Props, Mixins> => {
  const result: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};

  // Initialize result objects for each mixin
  for (const mixinKey of mixins) {
    result[mixinKey] = {};
  }

  // Process each prop
  for (const key in props) {
    let split = false;

    // Check if this prop belongs to any mixin
    for (const mixinKey of mixins) {
      if (!key.startsWith(mixinKey)) continue;

      split = true;
      const remainingKey = key.substring(mixinKey.length);
      const splitKey = remainingKey.charAt(0).toLowerCase() + remainingKey.slice(1);

      const splitProps = result[mixinKey] as Record<string, unknown>;
      splitProps[splitKey] = props[key as keyof typeof props];
    }

    if (!split) rest[key] = props[key as keyof typeof props];
  }

  result["rest"] = rest;
  return result as SplitProps<Props, Mixins>;
};
