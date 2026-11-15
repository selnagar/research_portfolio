/* Feature levels and cell assignments from the supplied reference image.
   As clarified by the researcher: central orange = Category 1;
   peripheral blue = Category 2 (overriding the image's category numbers).
   Rows run top to bottom and columns left to right. */
window.EXPERIMENT_DATA = {
  feature1Levels: [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1],
  feature2Levels: [1, 5 / 6, 4 / 6, 3 / 6, 2 / 6, 1 / 6],
  fullyInterleavedPerCategory: 8,
  categoryMap: [
    [2, 2, 2, 2, 1, 1],
    [2, 2, 2, 1, 1, 1],
    [2, 2, 1, 1, 1, 2],
    [2, 1, 1, 1, 2, 2],
    [1, 1, 1, 2, 2, 2],
    [1, 1, 2, 2, 2, 2]
  ],
  // true = an X in the reference image (new/novel). These never enter training.
  novelMap: [
    [true,  false, true,  false, true,  true ],
    [false, true,  true,  true,  false, false],
    [true,  false, false, true,  true,  false],
    [false, true,  false, false, true,  true ],
    [false, true,  true,  false, true,  true ],
    [false, false, true,  false, false, false]
  ],
  descriptions: {
    interleaved: 'All 16 selected old configurations appear once, in fully randomised order.',
    mixed: 'Three old configurations repeat 5, 5, and 6 times. All 16 presentations are randomised.',
    category: 'Two old configurations repeat eight times each. All 16 presentations are randomised.',
    configuration: 'One old configuration repeats eight times, followed by a different configuration repeated eight times.'
  }
};
