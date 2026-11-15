"""Export author-supplied model-family means and 95% bootstrap intervals.

Intervals are supplied endpoints, not recalculated from simulated observations.
Matplotlib is an optional authoring tool, not a website dependency.
"""
import json
import re
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
source = (ROOT / "results-data.js").read_text().split("window.PORTFOLIO_RESULTS =", 1)[1]
results = json.loads(source.strip().rstrip(";"))
groups = results["regimes"]
blue = re.search(r"--blue:\s*(#[0-9a-fA-F]{6})", (ROOT / "styles.css").read_text()).group(1)

with plt.rc_context({"font.family": "DejaVu Sans", "font.size": 11}):
    fig, ax = plt.subplots(figsize=(8.4, 5.4), facecolor="white")
    fig.subplots_adjust(left=0.26, right=0.97, bottom=0.22, top=0.82)
    for row, group in enumerate(groups):
        value = group["bic"]
        ax.errorbar(value["mean"], row,
                    xerr=[[value["mean"] - value["lower"]], [value["upper"] - value["mean"]]],
                    fmt="o", color=blue, capsize=5, markersize=8, linewidth=2)
    ax.axvline(0, color="#57536e", linestyle="--", linewidth=1)
    ax.set_xlim(-25, 90)
    ax.set_ylim(3.5, -0.5)
    ax.set_xticks([-25, 0, 30, 60, 90])
    ax.set_yticks(range(4))
    ax.set_yticklabels([group["label"] for group in groups])
    ax.set_xlabel("ΔBIC = Best WM − Best RuL")
    ax.set_title("Working Memory favoured ←  → Rule Learning favoured", fontsize=11, pad=18)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_visible(False)
    fig.text(0.04, 0.09, "Group-level model-family comparisons; not individual participant classifications.", fontsize=10)
    fig.text(0.04, 0.045, "95% confidence intervals from {:,} bootstrap resamples.".format(results["bootstrapResamples"]), fontsize=10)
    description = "Author-supplied mean BIC differences and 95% confidence intervals from 5,000 bootstrap resamples. Fixed axis −25 to +90. Negative favours WM; positive favours RuL."
    fig.savefig(ROOT / "assets/model-bic.svg", metadata={"Title": "Group-level model-family BIC comparison", "Description": description, "Date": None})
    fig.savefig(ROOT / "assets/model-bic.png", dpi=180, metadata={"Description": description})
    plt.close(fig)
print("Exported model-bic SVG and PNG from results-data.js.")
