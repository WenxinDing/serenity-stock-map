let series = {},
  archive = [],
  active = "AAOI",
  mode = "relative",
  range = "3",
  startDate = "",
  endDate = "",
  startDateInput,
  endDateInput;
document
  .querySelector(".controls")
  .insertAdjacentHTML(
    "beforeend",
    '<label>开始 <input id="startDateInput" type="date"></label><label>结束 <input id="endDateInput" type="date"></label>',
  );
startDateInput = document.getElementById("startDateInput");
endDateInput = document.getElementById("endDateInput");
document.head.insertAdjacentHTML(
  "beforeend",
  "<style>.grid{grid-auto-rows:540px;align-items:stretch}.grid>.panel{height:540px;min-height:540px;overflow:auto}@media(max-width:800px){.grid{grid-auto-rows:auto}.grid>.panel{height:auto;min-height:0}}</style>",
);
const tickers = (t) => [
  ...new Set((t.match(/\$[A-Z]{2,5}\b/g) || []).map((x) => x.slice(1))),
];
const esc = (t) =>
  String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function stance(t) {
  const s = t.toLowerCase(),
    bull = [
      "strong buy",
      "i bought",
      "bought $",
      "buying opportunity",
      "great investment",
      "bullish",
      "very bullish",
      "long-term winner",
      "re-rate",
      "rerate",
      "sold out",
      "capacity sold out",
      "positive outlook",
      "promising",
      "tailwind",
      "upside",
      "opportunity",
    ],
    bear = [
      "shareholder unfriendly",
      "harder to support",
      "incessant capital raise",
      "capital raises",
      "dilution",
      "dropping $",
      "dislike atm",
      "not too bullish",
      "not bullish",
      "bearish",
      "short thesis",
      "avoid",
      "sell/stop loss",
      "wouldn't buy",
      "overvalued",
      "too expensive",
      "weak demand",
      "margin pressure",
      "downside",
      "risk",
      "concern",
    ],
    bs = bull.reduce((n, x) => n + (s.includes(x) ? 1 : 0), 0),
    rs = bear.reduce((n, x) => n + (s.includes(x) ? 1 : 0), 0);
  if (rs > bs)
    return {
      label: rs >= 4 ? "强看空" : "中看空",
      cls: "bear",
      summary: "负面因素占主导，强调下行风险",
    };
  if (bs > rs)
    return {
      label: bs >= 4 ? "强看多" : "中看多",
      cls: "bull",
      summary: "正面因素占主导，强调增长、需求或上行空间",
    };
  return { label: "中性", cls: "neutral", summary: "多空因素接近，方向不明确" };
}
function translate(t) {
  if (
    /Very positive\. My opinion is that the optical sector underperformance/i.test(
      t,
    )
  )
    return "非常乐观。我的看法是，最近从 AAOI 到 SIVE 的整个光学行业表现落后得令人难以置信。需求的可见度高得离谱。AOI 表示：即使把 AOI 和 Coherent 的项目合在一起，未来三年（到2029年）也仍然很难满足客户需求。Elazar 的总经理表示，整个光学供应链都面临严重短缺，而且短缺还会持续数年。Sivers 的 CEO 也表达了同样的观点，预计未来3至5年 InP 激光器的供需仍会失衡。关于 LITE、MTSI 以及其他公司的类似评论还可以继续列举。我们甚至还没有真正进入 1.6T、NPO、CPO 的规模扩张阶段，也还没有充分看到内存与光学结合（例如 SK Hynix）的影响。然而，行业已经受到 EML/CW 以及其他上游部件的瓶颈限制，包括 PD、TIA、DSP、收发器；随着 CPO 扩大部署，FAU 等部件也很快会出现约束。我个人非常有信心地等待这一切展开，只是有些困惑：市场似乎还不会提前一两年计算未来的需求和供给。";
  if (
    /i don.t share usd amounts/i.test(t) &&
    /validating if a thesis is correct/i.test(t)
  )
    return "我不公开美元金额，因为在验证一个投资论点是否正确时，百分比才是关键。如果某人因为资金雄厚、持有1亿美元仓位，在AAOI上涨1%时赚了100万美元，这并不代表他的看多观点就是正确的。但我要说的是，AAOI的规模比很多人想象的更大。";
  const s = t.toLowerCase(),
    z = stance(t),
    sym = t.match(/\$[A-Z]{2,5}/g)?.join("、") || "该标的";
  let x = t.replace(/\$([A-Z]{2,5})/g, "$1");
  [
    ["I don’t share", "我不公开"],
    ["I don't share", "我不公开"],
    ["because", "因为"],
    ["what matters", "关键在于"],
    ["when validating", "在验证"],
    ["if a thesis is correct", "投资论点是否正确时"],
    ["If someone made", "如果有人赚到"],
    ["because they’re wealthy", "因为他们资金雄厚"],
    ["because they're wealthy", "因为他们资金雄厚"],
    ["had a", "持有"],
    ["position", "仓位"],
    ["that doesn’t mean", "这并不意味着"],
    ["that doesn't mean", "这并不意味着"],
    ["their long idea is correct", "其看多观点就是正确的"],
    ["But I will say", "但我要说的是"],
    ["it’s bigger than people think", "它比很多人想象的更大"],
    ["it\'s getting much harder to support", "越来越难以支持"],
    ["shareholder unfriendly", "对股东不友好"],
    ["capital raises", "融资增发"],
    ["dilution", "稀释"],
    ["demand", "需求"],
    ["growth", "增长"],
    ["revenue", "收入"],
    ["capacity", "产能"],
    ["risk", "风险"],
    ["concern", "担忧"],
  ].forEach(([a, b]) => (x = x.replace(new RegExp(a, "gi"), b)));
  return x;
}
async function remoteTranslate(t) {
  const key = "zh:" + t;
  try {
    const cached = localStorage.getItem(key);
    if (cached) return cached;
  } catch {}
  try {
    const parts = [],
      re = /[^.!?\n]+[.!?]?/g;
    let m,
      buf = "";
    while ((m = re.exec(t))) {
      const s = m[0].trim();
      if (!s) continue;
      if ((buf + " " + s).trim().length > 450) {
        if (buf) parts.push(buf.trim());
        buf = s;
      } else buf += (buf ? " " : "") + s;
    }
    if (buf) parts.push(buf.trim());
    const out = (
      await Promise.all(
        parts.map(async (part) => {
          const q = encodeURIComponent(part),
            r = await fetch(
              "https://api.mymemory.translated.net/get?q=" +
                q +
                "&langpair=en|zh-CN",
            ),
            j = await r.json();
          return j?.responseData?.translatedText || part;
        }),
      )
    ).join("");
    if (out) {
      try {
        localStorage.setItem(key, out);
      } catch {}
      return out;
    }
  } catch {}
  return translate(t) + "（机器翻译服务暂时不可用）";
}
function openDetail(t) {
  const z = stance(t.text);
  modalTitle.textContent = z.label + " · " + tickers(t.text).join(" / ");
  modalMeta.textContent = t.createdAtISO.replace("T", " ") + " · " + z.summary;
  modalText.textContent = t.text + "\n\n中文翻译（加载中）：";
  remoteTranslate(t.text).then((x) => {
    modalText.textContent = t.text + "\n\n中文翻译：\n" + x;
  });
  modalLink.href = "https://x.com/aleabitoreddit/status/" + t.id;
  modalBackdrop.classList.add("open");
}
function bounds() {
  let from = startDate,
    to = endDate;
  if (!from && !to && range !== "all") {
    const d = new Date();
    d.setMonth(d.getMonth() - Number(range));
    from = d.toISOString().slice(0, 10);
  }
  return { from: from || "0000-00-00", to: to || "9999-12-31" };
}
function render() {
  const full = series[active] || [],
    { from, to } = bounds(),
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
    related = (
      active === "QQQ"
        ? archive
        : archive.filter((t) => tickers(t.text).includes(active))
    ).filter((t) => {
      const d = t.createdAtISO.slice(0, 10);
      return d >= from && d <= to;
    }),
    marks = related
      .map((t) => {
        const d = t.createdAtISO.slice(0, 10),
          p = s.find((v) => v[0] >= d);
        return {
          t,
          z: stance(t.text),
          day: d,
          x: t.createdAtISO,
          a: p ? p[1] : null,
        };
      })
      .filter((v) => v.a != null),
    groups = {};
  marks.forEach((m) => (groups[m.day] ??= []).push(m));
  Object.values(groups).forEach((g) =>
    g.forEach(
      (m, i) =>
        (m.y =
          m.a +
          (i - (g.length - 1) / 2) *
            Math.max((s.at(-1)[1] - base) * 0.035, base * 0.012)),
    ),
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
  marks.forEach((m) =>
    traces.push({
      x: [m.day, m.x],
      y: [val(m.a), val(m.y)],
      type: "scatter",
      mode: "lines",
      line: {
        color:
          m.z.cls === "bull"
            ? "#64d8cb"
            : m.z.cls === "bear"
              ? "#f1789d"
              : "#f2b65d",
        width: 1,
      },
      hoverinfo: "skip",
    }),
  );
  traces.push({
    x: marks.map((m) => m.x),
    y: marks.map((m) => val(m.y)),
    type: "scatter",
    mode: "markers+text",
    text: marks.map((m) => m.z.label),
    textposition: marks.map((m, i) => (i % 2 ? "bottom center" : "top center")),
    textfont: { size: 11, color: "#edf3fa" },
    cliponaxis: false,
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
      "<b>%{text}</b><br>%{x|%Y-%m-%d %H:%M} UTC<br>ID: %{customdata}<extra></extra>",
  });
  Plotly.newPlot("chart", traces, {
    margin: { l: 55, r: 20, t: 35, b: 42 },
    paper_bgcolor: "#111a26",
    plot_bgcolor: "#111a26",
    font: { color: "#edf3fa" },
    xaxis: { gridcolor: "#263548", type: "date" },
    yaxis: {
      gridcolor: "#263548",
      title: mode === "relative" ? "指数（起点=100）" : "价格（USD）",
    },
    showlegend: false,
  });
  chart.on("plotly_click", (e) => {
    const q = e.points.find((p) => p.customdata),
      m = q && marks.find((v) => v.t.id === q.customdata);
    if (m) openDetail(m.t);
  });
  timeline.innerHTML = related
    .map((t) => {
      const z = stance(t.text);
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
        '…</p><p><strong>中文:</strong> <span class="translation">翻译加载中…</span>' +
        "</p></div>"
      );
    })
    .join("");
  document
    .querySelectorAll(".event")
    .forEach((e, i) => (e.onclick = () => openDetail(related[i])));
  document.querySelectorAll(".translation").forEach((el, i) =>
    remoteTranslate(related[i].text).then((x) => {
      el.textContent = x;
    }),
  );
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
        archive.filter((t) => tickers(t.text).includes(k)).length +
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
    [series, archive] = await Promise.all([
      fetch("market-data.json").then((r) => r.json()),
      fetch("archive.json").then((r) => r.json()),
    ]);
    tickerInput.value = active;
    document.querySelector(".panel .hint").textContent =
      "QQQ 显示全部观点；个股只显示相关观点。点击记录查看原文。当前默认：AAOI。";
    Object.keys(series)
      .sort()
      .forEach((k) => {
        const o = document.createElement("option");
        o.value = k;
        tickerOptions.appendChild(o);
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
