import type { Season } from '../../shared/types';

// One palette per season. Ground, foliage and water all shift together so a glance tells the time of year.
export type Palette = {
  grass: number[]; tuft: number; tuftLight: number; flowers: number[]; road: number; roadEdge: number; roadSpeck: number; plaza: number[]; mortar: number;
  water: number; waterDeep: number; waterLight: number; foam: number; bank: number; bankSpeck: number; soil: number; furrow: number; quarry: number; pebble: number[];
  meadow: number[]; meadowFlowers: number[]; wear: [number, number]; snow: boolean; leaves: number[][]; pine: number[]; bush: number[]; crop: number[];
};
export const palettes: Record<Season, Palette> = {
  spring: {
    grass: [0x8fbb62, 0x94c067, 0x89b55d, 0x9ac56d], tuft: 0x74a04e, tuftLight: 0xa9d27a, flowers: [0xf4b3cb, 0xfaf4e2, 0xf6dd72, 0xb9a3e8],
    road: 0xcfb383, roadEdge: 0xa98d5f, roadSpeck: 0xb99d6e, plaza: [0xc9bda4, 0xbdb096, 0xd3c8b0], mortar: 0xa39880,
    water: 0x4f9bb0, waterDeep: 0x3d8199, waterLight: 0x86c7d1, foam: 0xd6eef0, bank: 0xd5c08f, bankSpeck: 0xbfa877, soil: 0x8a6647, furrow: 0x6f5038, quarry: 0xa59a86, pebble: [0x8e8778, 0xbab09b],
    meadow: [0x92c165, 0x9ac86b], meadowFlowers: [0x6f8fe0, 0x9c7fe0, 0xf5f0e0, 0xf2cf5e], wear: [0xb5a574, 0xc4ae7f], snow: false,
    leaves: [[0x4f8a3f, 0x69a64c, 0x8cc466], [0x578f42, 0x74ae52, 0x98cc6e]], pine: [0x2f6147, 0x3f7a57, 0x5c9670], bush: [0x4b7f3d, 0x68a04f], crop: [0x7fb957, 0xa6d27a],
  },
  summer: {
    grass: [0x75a24f, 0x7aa854, 0x6f9a4a, 0x80ae59], tuft: 0x5d8a3f, tuftLight: 0x92bf66, flowers: [0xf5d45e, 0xfaf4e2, 0xe68a5c, 0xe9a3c4],
    road: 0xcdae7b, roadEdge: 0xa4875a, roadSpeck: 0xb69868, plaza: [0xc7b99e, 0xbaa98e, 0xd2c4aa], mortar: 0x9e9179,
    water: 0x3f93a8, waterDeep: 0x2f7890, waterLight: 0x7cc0cc, foam: 0xd0ecee, bank: 0xd8c18c, bankSpeck: 0xc0a674, soil: 0x86613f, furrow: 0x6a4b31, quarry: 0xa89c85, pebble: [0x8f8775, 0xbcb198],
    meadow: [0x7eac55, 0x86b45c], meadowFlowers: [0x5d7fd8, 0x8f6fd8, 0xf5d45e, 0xfaf4e2], wear: [0xb09d68, 0xc2a975], snow: false,
    leaves: [[0x3d6e35, 0x4f8a3f, 0x6aa84f], [0x456f33, 0x5b8a3d, 0x78a64f]], pine: [0x2a5a40, 0x3a7150, 0x538a65], bush: [0x3f6f35, 0x5a8c46], crop: [0x6c9f3f, 0x9ec95a],
  },
  autumn: {
    grass: [0xa39a5a, 0xaaa060, 0x9b9153, 0xb0a666], tuft: 0x8a7f45, tuftLight: 0xc2b572, flowers: [0xd9822b, 0xc2562f, 0xe3b240, 0xa8442a],
    road: 0xc4a372, roadEdge: 0x9a7c50, roadSpeck: 0xac8e5f, plaza: [0xbfb097, 0xb2a287, 0xcabca2], mortar: 0x968a72,
    water: 0x467f92, waterDeep: 0x356a7d, waterLight: 0x7eaeb8, foam: 0xcbe0e0, bank: 0xcbb383, bankSpeck: 0xb29a6c, soil: 0x7d5a3c, furrow: 0x62452e, quarry: 0xa0937d, pebble: [0x877e6d, 0xb2a78f],
    meadow: [0xa99f5e, 0xb3a864], meadowFlowers: [0xc98a3a, 0xa35a3a, 0xe0c060], wear: [0xa38d5e, 0xb89d6b], snow: false,
    leaves: [[0xa4452a, 0xd0702c, 0xe9a93a], [0xb07a22, 0xd9a53a, 0xf0cf5c], [0x8f3b2a, 0xb9512e, 0xd9763a]], pine: [0x2c553f, 0x3b6a4e, 0x537f60], bush: [0x8f6a33, 0xb58a3f], crop: [0xd9b04a, 0xf0d06a],
  },
  winter: {
    grass: [0xe9eff1, 0xeff4f5, 0xe3eaed, 0xf5f8f9], tuft: 0xc4cfd6, tuftLight: 0xffffff, flowers: [],
    road: 0xd8d2c5, roadEdge: 0xb8b0a2, roadSpeck: 0xc6bfb1, plaza: [0xd9d6d0, 0xcdc9c2, 0xe4e1db], mortar: 0xb7b2aa,
    water: 0x8ab8c8, waterDeep: 0x6fa0b5, waterLight: 0xc4e0e8, foam: 0xf2f8fa, bank: 0xe2e6e4, bankSpeck: 0xcfd5d3, soil: 0xcfc9c2, furrow: 0xb3aba2, quarry: 0xd3d4d2, pebble: [0xa8aaa6, 0xc2c4c0],
    meadow: [0xeef3f4, 0xe6edf0], meadowFlowers: [], wear: [0xcfc6b8, 0xdcd5c9], snow: true,
    leaves: [[0x5e4630, 0x755a3e, 0xffffff]], pine: [0x2d5442, 0x3b6852, 0xf5f9fa], bush: [0x6e5a45, 0x8a735a], crop: [0xcfc9c2, 0xe6e2dc],
  },
};
