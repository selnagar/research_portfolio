window.PORTFOLIO_RESULTS = {
  "bootstrapResamples": 5000,
  "accuracyRegression": { "slope": -0.034, "p": 0.001, "rSquared": 0.082 },
  "regimes": [
    { "id": "interleaved", "label": "Fully Interleaved", "manuscriptLabel": "Interleaved", "accuracy": 0.819, "bic": { "mean": 62.71, "lower": 44.98, "upper": 80.44 } },
    { "id": "mixed", "label": "Partially Interleaved", "manuscriptLabel": "Mixed Interleaved", "accuracy": 0.760, "bic": { "mean": 20.52, "lower": 4.94, "upper": 36.89 } },
    { "id": "category", "label": "Partially Blocked", "manuscriptLabel": "Category Blocked", "accuracy": 0.675, "bic": { "mean": 7.46, "lower": -5.08, "upper": 19.01 } },
    { "id": "configuration", "label": "Fully Blocked", "manuscriptLabel": "Configuration Blocked", "accuracy": 0.665, "bic": { "mean": 8.83, "lower": -18.25, "upper": 38.23 } }
  ]
};
