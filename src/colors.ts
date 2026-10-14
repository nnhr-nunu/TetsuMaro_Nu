/** 哲学者の色を薄めた背景・濃くした文字の色（CSS の color-mix。名簿の color から作る） */
export const tint = (color: string, percent = 16) => `color-mix(in srgb, ${color} ${percent}%, white)`;
export const shade = (color: string, percent = 72) => `color-mix(in srgb, ${color} ${percent}%, #1e1b3a)`;
