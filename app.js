let series = {},
  archive = [],
  translations = {},
  postsByTicker = {},
  mentionCount = {},
  active = "AAOI",
  mode = "relative",
  range = "3",
  startDate = "",
  endDate = "",
  startDateInput,
  endDateInput;
startDateInput = document.getElementById("startDateInput");
endDateInput = document.getElementById("endDateInput");
const tickers = (t) => [
  ...new Set((t.match(/\$[A-Z]{2,5}\b/g) || []).map((x) => x.slice(1))),
];
const esc = (t) =>
  String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function stance(text, symbol = "") {
  const chunks = String(text).split(/\n\n+|(?<=[.!?])\s+/);
  const symbolText = symbol ? "$" + symbol.toUpperCase() : "";
  const context = symbolText
    ? chunks.filter((chunk) => chunk.toUpperCase().includes(symbolText)).join(" ")
    : String(text);
  const source = (context || text).toLowerCase();
  const score = (terms) => terms.reduce((sum, pair) => sum + (source.includes(pair[0]) ? pair[1] : 0), 0);
  const bull = score([
    ["very positive", 6], ["extremely positive", 6], ["strong buy", 6],
    ["favorite high-beta", 6], ["my favorite", 4], ["very bullish", 5],
    ["bullish", 3], ["i bought", 4], ["buying opportunity", 4],
    ["positive outlook", 3], ["demand visibility", 3], ["sold out", 3],
    ["capacity shortage", 3], ["long-term winner", 3], ["tailwind", 2],
    ["upside", 2], ["opportunity", 1],
  ]);
  const bear = score([
    ["strong short", 6], ["shareholder unfriendly", 6], ["harder to support", 5],
    ["incessant capital raise", 5], ["capital raises", 4], ["dilution", 4],
    ["no meaningful participation", 5], ["not participating", 4],
    ["not too bullish", 4], ["not bullish", 4], ["bearish", 3],
    ["short thesis", 4], ["wouldn't buy", 4], ["overvalued", 4],
    ["too expensive", 4], ["weak demand", 3], ["margin pressure", 3],
    ["downside", 2], ["risk", 1], ["concern", 1],
  ]);
  const net = bull - bear;
  if (net >= 6) return { label: "强看多", cls: "bull", summary: "明确看多，强调业绩、需求或估值上行" };
  if (net >= 2) return { label: "中看多", cls: "bull", summary: "偏向看多，关注增长、需求或催化" };
  if (net <= -6) return { label: "强看空", cls: "bear", summary: "明确看空，强调融资、基本面或估值风险" };
  if (net <= -2) return { label: "中看空", cls: "bear", summary: "偏向看空，关注下行风险或不利因素" };
  return { label: "中性", cls: "neutral", summary: "观点未形成清晰的多空方向" };
}
function openDetail(t) {
  const z = stance(t.text, active === "QQQ" ? "" : active);
  modalTitle.textContent = z.label + " · " + tickers(t.text).join(" / ");
  modalMeta.textContent = t.createdAtISO.replace("T", " ") + " · " + z.summary;
  modalText.textContent = t.text + "\n\n中文翻译：\n" + (translations[t.id] || "该观点尚未生成完整中文译文。");
  modalLink.href = "https://x.com/aleabitoreddit/status/" + t.id;
  modalBackdrop.classList.add("open");
}
function bounds(full) {
  const lastTradingDay = full.at(-1)?.[0] || new Date().toISOString().slice(0, 10);
  let from = startDate;
  const to = endDate || lastTradingDay;
  if (!from && range !== "all") {
    const d = new Date(lastTradingDay + "T12:00:00");
    d.setMonth(d.getMonth() - Number(range));
    from = d.toISOString().slice(0, 10);
  }
  return { from: from || full[0]?.[0] || "0000-00-00", to };
}
function render() {
  const full = series[active] || [],
    { from, to } = bounds(full),
    s = full.filter((v) => v[0] >= from && v[0] <= to);
  if (!s.length) {
    chart.innerHTML =
      '<div style="padding:24px;color:#f2b65d">该标的暂无可用日线行情。</div>';
    return;
  }
  const dates = s.map((v) => v[0]),
    base = s[0][1],
    y =
      mode === "relative"
        ? s.map((v) => +((v[1] / base) * 100).toFixed(2))
        : s.map((v) => v[1]),
    related = (active === "QQQ" ? archive : postsByTicker[active] || []).filter((t) => {
      const d = t.createdAtISO.slice(0, 10);
      return d >= from && d <= to;
    }),
    marks = related
      .map((t) => {
        const d = t.createdAtISO.slice(0, 10),
          p = s.find((v) => v[0] >= d);
        return {
          t,
          z: stance(t.text, active === "QQQ" ? "" : active),
          day: d,
          x: t.createdAtISO,
          a: p ? p[1] : null,
        };
      })
      .filter((v) => v.a != null),
    groups = {};
  marks.forEach((m) => (groups[m.day] ??= []).push(m));
  Object.values(groups).forEach((g) =>
    g.forEach((m, i) => {
      const level = Math.floor(i / 2);
      m.y = m.a;
      m.ax = (i % 2 ? 1 : -1) * (24 + level * 12);
      m.ay = (i % 2 ? 1 : -1) * (52 + level * 30);
    }),
  );
  const val = (v) => (mode === "relative" ? +((v / base) * 100).toFixed(2) : v),
    traces = [
      {
        x: dates,
        y,
        type: "scatter",
        mode: "lines",
        line: { color: "#64d8cb", width: 2.5 },
        hoverinfo: "skip",
      },
    ];
  traces.push({
    x: marks.map((m) => m.day),
    y: marks.map((m) => val(m.a)),
    type: "scatter",
    mode: "markers",
    marker: {
      size: 15,
      line: { color: "#0b1018", width: 2 },
      color: marks.map((m) =>
        m.z.cls === "bull"
          ? "#64d8cb"
          : m.z.cls === "bear"
            ? "#f1789d"
            : "#f2b65d",
      ),
    },
    customdata: marks.map((m) => m.t.id),
    hovertemplate:
      "<b>观点</b><br>%{x|%Y-%m-%d}<br>点击查看原文与中文译文<extra></extra>",
  });
  Plotly.newPlot("chart", traces, {
    margin: { l: 55, r: 30, t: 84, b: 54 },
    paper_bgcolor: "#111a26",
    plot_bgcolor: "#111a26",
    font: { color: "#edf3fa" },
    xaxis: { gridcolor: "#263548", type: "date", range: [from, to] },
    yaxis: {
      gridcolor: "#263548",
      title: mode === "relative" ? "指数（起点=100）" : "价格（USD）",
    },
    annotations: marks.filter((m) => m.z.cls !== "neutral").map((m) => ({
      x: m.day,
      y: val(m.a),
      text: m.z.label,
      showarrow: true,
      arrowhead: 0,
      arrowwidth: 1,
      arrowcolor: m.z.cls === "bull" ? "#64d8cb" : m.z.cls === "bear" ? "#f1789d" : "#f2b65d",
      ax: m.ax,
      ay: m.ay,
      bgcolor: "#111a26",
      bordercolor: m.z.cls === "bull" ? "#64d8cb" : m.z.cls === "bear" ? "#f1789d" : "#f2b65d",
      borderwidth: 1,
      borderpad: 3,
      font: { size: 11, color: "#edf3fa" },
      opacity: 0.98,
    })),
    showlegend: false,
  });
  chart.on("plotly_click", (e) => {
    const q = e.points.find((p) => p.customdata),
      m = q && marks.find((v) => v.t.id === q.customdata);
    if (m) openDetail(m.t);
  });
  timeline.innerHTML = related
    .map((t) => {
      const z = stance(t.text, active === "QQQ" ? "" : active);
      return (
        '<div class="event"><span class="date">' +
        t.createdAtISO.slice(0, 16).replace("T", " ") +
        '</span><span class="ticker">' +
        tickers(t.text).join(" ") +
        '</span> <b class="' +
        z.cls +
        '">' +
        z.label +
        "</b><div>" +
        z.summary +
        "</div><p><strong>EN:</strong> " +
        esc(t.text).slice(0, 500) +
    '…</p><p><strong>中文:</strong> <span class="translation">' + esc(translations[t.id] || '该观点尚未生成完整中文译文。') + '</span>' +
        "</p></div>"
      );
    })
    .join("");
  document
    .querySelectorAll(".event")
    .forEach((e, i) => (e.onclick = () => openDetail(related[i])));
  perf.innerHTML = Object.keys(series)
    .map((k) => {
      const v = series[k].filter((x) => x[0] >= from && x[0] <= to),
        p = v.length ? v.at(-1)[1] / v[0][1] - 1 : 0;
      return (
        '<tr><td><button data-sym="' +
        k +
        '" style="background:none;border:0;color:#edf3fa;cursor:pointer"><b>' +
        k +
        "</b></button></td><td>" +
        (mentionCount[k] || 0) +
        '</td><td class="' +
        (p >= 0 ? "pos" : "neg") +
        '">' +
        (p >= 0 ? "+" : "") +
        (p * 100).toFixed(1) +
        "%</td></tr>"
      );
    })
    .join("");
  document.querySelectorAll("[data-sym]").forEach(
    (b) =>
      (b.onclick = () => {
        active = b.dataset.sym;
        tickerInput.value = active;
        render();
      }),
  );
}
async function init() {
  try {
    [series, archive, translations] = await Promise.all([
      fetch("market-data.json").then((r) => r.json()),
      fetch("archive-ui.json").then((r) => r.json()),
      fetch("translations.json").then((r) => r.json()).catch(() => ({})),
    ]);
    archive.forEach((post) => {
      tickers(post.text).forEach((ticker) => {
        (postsByTicker[ticker] ||= []).push(post);
        mentionCount[ticker] = (mentionCount[ticker] || 0) + 1;
      });
    });
    tickerInput.value = active;
    document.querySelector(".panel .hint").textContent =
      "AAOI 仅显示相关观点；QQQ 可查看全部归档观点。点击记录查看原文与中文译文。";
    Object.keys(series)
      .sort()
      .forEach((k) => {
        if (k === active) return;
        const o = document.createElement("option");
        o.value = k;
        tickerInput.appendChild(o);
      });
    tickerInput.addEventListener("change", (e) => {
      const k = e.target.value.toUpperCase();
      if (series[k]) {
        active = k;
        e.target.value = k;
        render();
      }
    });
    tickerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.target.dispatchEvent(new Event("change"));
    });
    document.querySelectorAll("[data-mode]").forEach(
      (b) =>
        (b.onclick = () => {
          mode = b.dataset.mode;
          document
            .querySelectorAll("[data-mode]")
            .forEach((x) => x.classList.toggle("active", x === b));
          render();
        }),
    );
    rangeSelect.onchange = (e) => {
      range = e.target.value;
      startDate = "";
      endDate = "";
      render();
    };
    startDateInput.onchange = (e) => {
      startDate = e.target.value;
      range = "custom";
      render();
    };
    endDateInput.onchange = (e) => {
      endDate = e.target.value;
      range = "custom";
      render();
    };
    render();
  } catch (e) {
    chart.textContent = "数据加载失败，请使用本地 HTTP 服务打开。";
    console.error(e);
  }
}
closeModal.onclick = () => modalBackdrop.classList.remove("open");
modalBackdrop.onclick = (e) => {
  if (e.target === modalBackdrop) e.currentTarget.classList.remove("open");
};
init();
