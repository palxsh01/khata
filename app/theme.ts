// tokens from design.md
export const color = {
  bg: '#1E2529',
  surface: '#2A2F32',
  surfaceRaised: '#41474B',
  surfaceMuted: '#484B50',
  divider: '#FFFFFF0F',
  track: '#3E4449',
  text: '#FFFFFF',
  textSecondary: '#9AA1A6',
  textTertiary: '#5F666B',
  positive: '#9EDDBF',
  positiveStrong: '#16B39C',
  negative: '#F67B93',
  fab: '#E6E8EA'
};

export const radius = { card: 24, tile: 12, full: 999 };

export const space = { gutter: 20, card: 16, section: 24 };

// category / person / account colours, assigned by id so they stay stable
export const palette = ['#8B8CFB', '#2DCBFF', '#F67B93', '#FDB088', '#FDE28B', '#F098D8', '#16B39C'];
export const paletteFor = (id: number) => palette[id % palette.length];
