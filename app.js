const DATA_URL = "./data/nabory.json";

const state = {
  records: [],
  filtered: [],
};

const els = {
  generatedAt: document.getElementById("generated-at"),
  metricActive: document.getElementById("metric-active"),
  metricUpcoming: document.getElementById("metric-upcoming"),
  metricTotal: document.getElementById("metric-total"),
  metricWoj: document.getElementById("metric-woj"),
  search: document.getElementById("search-input"),
  wojFilter: document.getElementById("woj-filter"),
  statusFilter: document.getElementById("status-filter"),
  sortFilter: document.getElementById("sort-filter"),
  resultsCount: document.getElementById("results-count"),
  resultsBody: document.getElementById("results-body"),
  emptyState: document.getElementById("empty-state"),
  rowTemplate: document.getElementById("row-template"),
};

const statusLabels = {
  active: "Aktywny",
  upcoming: "Planowany",
  past: "Zakończony",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pl-PL");
}

function formatDateTime(dateValue, timeValue) {
  if (!dateValue) return "-";
  return timeValue ? `${formatDate(dateValue)} ${timeValue}` : formatDate(dateValue);
}

function toSortableTimestamp(dateValue, timeValue) {
  if (!dateValue) return 0;
  if (timeValue === "24:00") {
    return new Date(`${dateValue}T00:00:00`).getTime() + 24 * 60 * 60 * 1000;
  }
  return new Date(`${dateValue}T${timeValue || "00:00"}:00`).getTime();
}

function formatGeneratedAt(value) {
  if (!value) return "Brak danych";
  return new Date(value).toLocaleString("pl-PL");
}

function populateFilters(records) {
  const wojs = [...new Set(records.map((record) => record.woj).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pl"));
  for (const woj of wojs) {
    const option = document.createElement("option");
    option.value = woj;
    option.textContent = woj;
    els.wojFilter.append(option);
  }
}

function updateMetrics(records) {
  const active = records.filter((record) => record.status === "active").length;
  const upcoming = records.filter((record) => record.status === "upcoming").length;
  const wojs = new Set(records.map((record) => record.woj)).size;

  els.metricActive.textContent = active;
  els.metricUpcoming.textContent = upcoming;
  els.metricTotal.textContent = records.length;
  els.metricWoj.textContent = wojs;
}

function compareDateTimes(leftDate, leftTime, rightDate, rightTime) {
  const leftValue = toSortableTimestamp(leftDate, leftTime);
  const rightValue = toSortableTimestamp(rightDate, rightTime);
  return leftValue - rightValue;
}

function sortRecords(records) {
  const mode = els.sortFilter.value;
  const statusOrder = { active: 0, upcoming: 1, past: 2 };
  const sorted = [...records];

  sorted.sort((left, right) => {
    if (mode === "date-asc") {
      return compareDateTimes(left.nabor_od, left.nabor_od_czas, right.nabor_od, right.nabor_od_czas)
        || left.siedziba.localeCompare(right.siedziba, "pl");
    }

    if (mode === "date-desc") {
      return compareDateTimes(right.nabor_od, right.nabor_od_czas, left.nabor_od, left.nabor_od_czas)
        || left.siedziba.localeCompare(right.siedziba, "pl");
    }

    if (mode === "place-asc") {
      return left.siedziba.localeCompare(right.siedziba, "pl")
        || compareDateTimes(left.nabor_od, left.nabor_od_czas, right.nabor_od, right.nabor_od_czas);
    }

    return (statusOrder[left.status] ?? 99) - (statusOrder[right.status] ?? 99)
      || compareDateTimes(left.nabor_od, left.nabor_od_czas, right.nabor_od, right.nabor_od_czas)
      || left.siedziba.localeCompare(right.siedziba, "pl");
  });

  return sorted;
}

function renderTable(records) {
  els.resultsBody.innerHTML = "";
  els.emptyState.hidden = records.length !== 0;
  els.resultsCount.textContent = `${records.length} rekordów`;

  for (const record of records) {
    const row = els.rowTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector('[data-column="place"]').innerHTML = `
      <div class="place-title">${record.siedziba || "Brak siedziby"}</div>
      <div class="place-subtitle">${record.powiat || "brak powiatu"}</div>
    `;
    row.querySelector('[data-column="woj"]').textContent = record.woj || "-";
    row.querySelector('[data-column="contact"]').textContent = record.kontakt_tel || "-";
    row.querySelector('[data-column="from"]').textContent = formatDateTime(record.nabor_od, record.nabor_od_czas);
    row.querySelector('[data-column="to"]').textContent = formatDateTime(record.nabor_do, record.nabor_do_czas);
    row.querySelector('[data-column="type"]').innerHTML = `<span class="pill ${record.typ_naboru === "rezerwowy" ? "pill-type-reserve" : "pill-type-basic"}">${record.typ_naboru}</span>`;
    row.querySelector('[data-column="status"]').innerHTML = `<span class="pill pill-status-${record.status}">${statusLabels[record.status] || record.status}</span>`;

    const linkCell = row.querySelector('[data-column="link"]');
    if (record.www) {
      const link = document.createElement("a");
      link.href = record.www;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Otwórz";
      linkCell.append(link);
    } else {
      linkCell.textContent = "-";
    }

    els.resultsBody.append(row);
  }
}

function applyFilters() {
  const searchValue = els.search.value.trim().toLocaleLowerCase("pl");
  const wojValue = els.wojFilter.value;
  const statusValue = els.statusFilter.value;

  state.filtered = state.records.filter((record) => {
    const haystack = [
      record.woj,
      record.siedziba,
      record.powiat,
      record.typ_naboru,
      record.nabor_od_czas,
      record.nabor_do_czas,
      statusLabels[record.status],
    ].join(" ").toLocaleLowerCase("pl");

    const matchesSearch = !searchValue || haystack.includes(searchValue);
    const matchesWoj = !wojValue || record.woj === wojValue;
    const matchesStatus = !statusValue || record.status === statusValue;
    return matchesSearch && matchesWoj && matchesStatus;
  });

  renderTable(sortRecords(state.filtered));
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    state.records = data.records || [];
    els.generatedAt.textContent = formatGeneratedAt(data.generated_at);
    populateFilters(state.records);
    updateMetrics(state.records);
    applyFilters();
  } catch (error) {
    els.generatedAt.textContent = "Nie udało się załadować pliku danych";
    els.emptyState.hidden = false;
    els.emptyState.innerHTML = `
      <h3>Nie udało się załadować danych</h3>
      <p>Sprawdź, czy build wygenerował plik <code>web/data/nabory.json</code>.</p>
    `;
    console.error(error);
  }
}

els.search.addEventListener("input", applyFilters);
els.wojFilter.addEventListener("change", applyFilters);
els.statusFilter.addEventListener("change", applyFilters);
els.sortFilter.addEventListener("change", applyFilters);

init();