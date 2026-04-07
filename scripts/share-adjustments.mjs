const SHARE_BASIS_ACTIONS = [
  {
    effectiveDate: "2024-08-08",
    factor: 10,
    note:
      "10-for-1 stock split distributed after the close of trading on 2024-08-07; MSTR began split-adjusted trading on 2024-08-08.",
  },
];

function multiplyIfNumber(value, factor) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * factor) : value;
}

export function alignSharesWithSplitAdjustedPrices(rows) {
  return rows.map((row) => {
    const applicableActions = SHARE_BASIS_ACTIONS.filter((action) => row.date < action.effectiveDate);
    if (applicableActions.length === 0) {
      return row;
    }

    const factor = applicableActions.reduce((product, action) => product * action.factor, 1);

    return {
      ...row,
      sharesOutstanding: multiplyIfNumber(row.sharesOutstanding, factor),
      classAShares: multiplyIfNumber(row.classAShares, factor),
      classBShares: multiplyIfNumber(row.classBShares, factor),
      adjustmentNote: applicableActions.map((action) => action.note).join(" "),
      priceSeriesBasis: "split-adjusted",
    };
  });
}
