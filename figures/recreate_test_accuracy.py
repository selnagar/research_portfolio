"""Export the author-supplied test means; no participant data or uncertainty inferred.

Matplotlib is an optional authoring tool, not a website dependency.
"""
import json
import re
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MultipleLocator

ROOT = Path(__file__).resolve().parent.parent
source = (ROOT / "results-data.js").read_text().split("window.PORTFOLIO_RESULTS =", 1)[1]
results = json.loads(source.strip().rstrip(";"))
groups = results["regimes"]
blue = re.search(r"--blue:\s*(#[0-9a-fA-F]{6})", (ROOT / "styles.css").read_text()).group(1)

with plt.rc_context({"font.family": "DejaVu Sans", "font.size": 13}):
    fig, ax = plt.subplots(figsize=(7.8, 9.2), facecolor="white")
    fig.subplots_adjust(left=0.14, right=0.97, bottom=0.20, top=0.95)
    x = list(range(4))
    means = [group["accuracy"] for group in groups]
    ax.bar(x, means, width=0.65, color=blue, zorder=2)
    for position, value in zip(x, means):
        ax.text(position, value + 0.02, "{:.1f}%".format(100 * value), ha="center", color=blue)
    ax.set_ylabel("Mean test accuracy")
    ax.set_ylim(0, 1)
    ax.set_xticks(x)
    ax.set_xticklabels([group["label"].replace(" ", "\n", 1) for group in groups], fontsize=11)
    ax.yaxis.set_major_locator(MultipleLocator(0.2))
    ax.grid(axis="y", color="#e7e3fa", zorder=0)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    regression = results["accuracyRegression"]
    fig.text(0.14, 0.08, "OLS slope β = {slope:.3f} · p = {p:.3f} · R² = {rSquared:.3f}".format(**regression), fontsize=11)
    fig.text(0.14, 0.045, "Left → right: less interleaving, more blocking.", fontsize=11)
    description = "Author-supplied test-phase means. No participant-level dots, confidence intervals, or error bars are inferred."
    fig.savefig(ROOT / "assets/test-accuracy.svg", metadata={"Title": "Mean test accuracy", "Description": description, "Date": None})
    fig.savefig(ROOT / "assets/test-accuracy.png", dpi=180, metadata={"Description": description})
    plt.close(fig)
print("Exported test-accuracy SVG and PNG from results-data.js.")
