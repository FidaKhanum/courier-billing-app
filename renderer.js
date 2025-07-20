/*************************************************
 * Utility
 *************************************************/
function formatMoney(n) {
  return Number(n || 0).toFixed(2);
}

function numberToWords(num) {
  if (num === 0) return "Zero Rupees";
  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  function inWords(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        " Hundred" +
        (n % 100 ? " " + inWords(n % 100) : "")
      );
    if (n < 100000)
      return (
        inWords(Math.floor(n / 1000)) +
        " Thousand" +
        (n % 1000 ? " " + inWords(n % 1000) : "")
      );
    if (n < 10000000)
      return (
        inWords(Math.floor(n / 100000)) +
        " Lakh" +
        (n % 100000 ? " " + inWords(n % 100000) : "")
      );
    return (
      inWords(Math.floor(n / 10000000)) +
      " Crore" +
      (n % 10000000 ? " " + inWords(n % 10000000) : "")
    );
  }
  return inWords(num) + " Rupees Only";
}

/** Convert yyyy-mm-dd -> dd-mm-yyyy (fallback passthru) */
function formatDate(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d)) return dateString;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

/** Return today's date as yyyy-mm-dd (for <input type="date">) */
function todayISO() {
  const t = new Date();
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const dd = String(t.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/*************************************************
 * State
 *************************************************/
let consignments = []; // [{date, conNo, consignee, weight, destination, amount}]
let currentEditIdx = null; // row being edited
let viewingPastBill = false; // lock UI when in view mode

/*************************************************
 * DOM refs
 *************************************************/
const entryForm = document.getElementById("entry-form");
const rowDateInput = document.getElementById("bill-date"); // per-row date
const billSaveDateInput = document.getElementById("bill-save-date"); // bill header date (store/print)
const conNoInput = document.getElementById("con-no");
const consigneeSelect = document.getElementById("consignee");
const destinationSelect = document.getElementById("destination");
const weightValueInput = document.getElementById("weight-value");
const amountInput = document.getElementById("amount");
const addRowBtn = document.getElementById("add-row");
const entryTableBody = document.querySelector("#entry-table tbody");

const totalSpan = document.getElementById("total");
const gstPercentInput = document.getElementById("gst-percent");
const gstAmountSpan = document.getElementById("gst-amount");
const grandTotalSpan = document.getElementById("grand-total");

const generateBillBtn = document.getElementById("generate-bill");
const printBillBtn = document.getElementById("print-bill");
const newBillBtn = document.getElementById("new-bill-btn");

const pastBillsList = document.getElementById("past-bills-list");
const viewDateInput = document.getElementById("view-date");
const viewBillBtn = document.getElementById("view-bill");

const consigneeAddRow = document.getElementById("consignee-add-row");
const consigneeNewValue = document.getElementById("consignee-new-value");
const destinationAddRow = document.getElementById("destination-add-row");
const destinationNewValue = document.getElementById("destination-new-value");

/*************************************************
 * Init default dates
 *************************************************/
function initDates() {
  rowDateInput.value = todayISO();
  if (billSaveDateInput) {
    billSaveDateInput.value = todayISO();
  }
}

/*************************************************
 * Dropdown fill
 *************************************************/
function fillDropdown(type, selectEl) {
  window.api.getDropdown(type).then((list) => {
    selectEl.innerHTML = '<option value="" disabled selected>Select</option>';
    list.forEach((val) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      selectEl.appendChild(opt);
    });
  });
}

/*************************************************
 * Render Consignment Table
 *************************************************/
function renderTable() {
  entryTableBody.innerHTML = "";
  consignments.forEach((c, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${formatDate(c.date)}</td>
      <td>${c.conNo}</td>
      <td>${c.consignee}</td>
      <td>${c.weight || ""}</td>
      <td>${c.destination}</td>
      <td>₹${formatMoney(c.amount)}</td>
      <td><button type="button" onclick="editRow(${idx})">Edit</button></td>
      <td><button type="button" onclick="deleteRow(${idx})">Delete</button></td>
    `;
    entryTableBody.appendChild(tr);
  });
  generateBillBtn.disabled = consignments.length === 0;
  printBillBtn.disabled = consignments.length === 0;
  calculateTotals();
}

/*************************************************
 * Totals
 *************************************************/
function calculateTotals() {
  const total = consignments.reduce(
    (sum, c) => sum + (parseFloat(c.amount) || 0),
    0
  );
  const pct = parseFloat(gstPercentInput.value) || 0;
  const gst = (total * pct) / 100;
  const grand = total + gst;
  totalSpan.textContent = formatMoney(total);
  gstAmountSpan.textContent = formatMoney(gst);
  grandTotalSpan.textContent = formatMoney(grand);
}
gstPercentInput.addEventListener("input", calculateTotals);

/*************************************************
 * Add / Save a row
 *************************************************/
addRowBtn.addEventListener("click", () => {
  if (viewingPastBill) return;

  const date = rowDateInput.value.trim();
  const conNo = conNoInput.value.trim();
  const consignee = consigneeSelect.value.trim();
  const destination = destinationSelect.value.trim();
  const weightValue = weightValueInput.value.trim();
  const weightMetric = document.querySelector(
    'input[name="weight-metric"]:checked'
  )?.value;
  const weight =
    weightValue || weightMetric
      ? `${weightValue} ${weightMetric}`
      : weightValue || "";
  const amount = parseFloat(amountInput.value);
  if (!date || !consignee || !destination || isNaN(amount)) {
    alert("Please fill all fields.");
    return;
  }

  if (currentEditIdx === null && consignments.some((c) => c.conNo === conNo)) {
    alert("Consignment number already exists in this bill.");
    conNoInput.focus();
    return;
  }

  const entry = { date, conNo, consignee, weight, destination, amount };

  if (currentEditIdx !== null) {
    consignments[currentEditIdx] = entry;
    currentEditIdx = null;
    addRowBtn.textContent = "Add Row";
  } else {
    consignments.push(entry);
  }

  // Clear per-row fields (keep row date as-is in case multiple for same day)
  amountInput.value = "";
  weightValueInput.value = "";
  document
    .querySelectorAll('input[name="weight-metric"]')
    .forEach((r) => (r.checked = false));
  consigneeSelect.value = "";
  destinationSelect.value = "";
  conNoInput.value = "";
  conNoInput.focus();

  renderTable();
});

/*************************************************
 * Edit / Delete row (exported to window)
 *************************************************/
window.editRow = (idx) => {
  if (viewingPastBill) return;
  const c = consignments[idx];
  rowDateInput.value = c.date;
  conNoInput.value = c.conNo;
  consigneeSelect.value = c.consignee;
  destinationSelect.value = c.destination;

  // weight
  if (c.weight) {
    const [val, metric] = c.weight.split(" ");
    weightValueInput.value = val;
    const radio = document.querySelector(
      `input[name="weight-metric"][value="${metric}"]`
    );
    if (radio) radio.checked = true;
  } else {
    weightValueInput.value = "";
    document
      .querySelectorAll('input[name="weight-metric"]')
      .forEach((r) => (r.checked = false));
  }

  amountInput.value = c.amount;
  currentEditIdx = idx;
  addRowBtn.textContent = "Save";
  conNoInput.focus();
};

window.deleteRow = (idx) => {
  if (viewingPastBill) return;
  if (!confirm("Delete this row?")) return;
  consignments.splice(idx, 1);
  if (currentEditIdx === idx) {
    currentEditIdx = null;
    addRowBtn.textContent = "Add Row";
  }
  renderTable();
};

/*************************************************
 * Save (Generate) Bill
 *************************************************/
async function saveBillFlow(askToPrint = true) {
  if (viewingPastBill) return;

  if (consignments.length === 0) {
    alert("No consignments to save.");
    return;
  }
  const billDate = (billSaveDateInput?.value || "").trim();
  if (!billDate) {
    alert("Please choose the Bill Date (top-right field).");
    billSaveDateInput?.focus();
    return;
  }

  const gstPct = parseFloat(gstPercentInput.value) || 0;
  const total = parseFloat(totalSpan.textContent) || 0;
  const gstAmount = parseFloat(gstAmountSpan.textContent) || 0;
  const grandTotal = parseFloat(grandTotalSpan.textContent) || 0;

  try {
    const billId = await window.api.saveBill({
      date: billDate, // <-- bill header date (NOT last row date)
      gstPercent: gstPct,
      gstAmount,
      total,
      grandTotal,
      items: consignments,
    });

    viewingPastBill = false; // we just saved a fresh bill
    if (!askToPrint) {
      alert(`✅ Bill #${billId} saved.`);
      resetEntryMode();
      return;
    }

    const shouldPrint = confirm(
      `✅ Bill #${billId} saved!\n\nDo you want to print it now?`
    );
    if (shouldPrint) {
      handlePrint(billId, billDate);
    } else {
      resetEntryMode();
    }
  } catch (e) {
    alert("Error saving bill: " + e.message);
  }
}
generateBillBtn.addEventListener("click", () => saveBillFlow(true));

/*************************************************
 * View Past Bills
 *************************************************/
viewBillBtn.addEventListener("click", async () => {
  const date = viewDateInput.value;
  if (!date) return alert("Please select a date.");
  pastBillsList.innerHTML = "Loading...";
  try {
    const bills = await window.api.getBillsByDate(date);
    if (!bills.length) {
      pastBillsList.innerHTML = "<p>No bills found for this date.</p>";
      return;
    }
    pastBillsList.innerHTML = "";
    bills.forEach((bill) => {
      const div = document.createElement("div");
      div.className = "old-bill-block";
      div.innerHTML = `
        <b>Bill #${bill.id}</b> | Date: ${formatDate(
        bill.bill_date
      )} | Grand Total: ₹${formatMoney(bill.grand_total)}
        <button type="button" onclick="viewBill(${bill.id})">View</button>
      `;
      window[`_bill${bill.id}`] = bill;
      pastBillsList.appendChild(div);
    });
  } catch (e) {
    pastBillsList.innerHTML = `<p>Error loading bills: ${e.message}</p>`;
  }
});

window.viewBill = (id) => {
  const bill = window[`_bill${id}`];
  if (!bill) return;

  // Fill bill-level fields
  if (billSaveDateInput) billSaveDateInput.value = bill.bill_date;
  gstPercentInput.value = bill.gst_percent;

  // Load consignments
  consignments = bill.items || [];
  renderTable();
  calculateTotals();

  // Lock entry controls
  viewingPastBill = true;
  setEntryEnabled(false);

  printBillBtn.disabled = false; // allow printing
  alert(
    'Viewing a past bill. Click Print if you want a copy, or "New Bill" to start fresh.'
  );
};

/*************************************************
 * Enable/Disable Entry Controls
 *************************************************/
function setEntryEnabled(enabled) {
  // everything inside entry form
  entryForm.querySelectorAll("input, select, button").forEach((el) => {
    el.disabled = !enabled;
  });
  // top totals buttons except generate/print/new handled separately
  generateBillBtn.disabled = !enabled || consignments.length === 0;
  // print will be explicitly toggled elsewhere
}

/*************************************************
 * Reset / New Bill
 *************************************************/
async function resetEntryMode() {
  viewingPastBill = false;

  // Re-enable form controls
  setEntryEnabled(true);

  // Reset & defaults
  entryForm.reset();
  initDates();
  consignments = [];
  currentEditIdx = null;
  addRowBtn.textContent = "Add Row";

  renderTable();
  calculateTotals();

  // repopulate dropdowns
  fillDropdown("consignee", consigneeSelect);
  fillDropdown("destination", destinationSelect);

  conNoInput.value = "";
  conNoInput.focus();

  // hide inline add rows if open
  consigneeAddRow.style.display = "none";
  destinationAddRow.style.display = "none";

  printBillBtn.disabled = true;
}
newBillBtn.addEventListener("click", resetEntryMode);

/*************************************************
 * Print
 *************************************************/
function handlePrint(NULL, NULL) {
  const billDate =
    billDateOverride || billSaveDateInput?.value || rowDateInput.value;
  document.getElementById("print-bill-date").textContent = formatDate(billDate);
  document.getElementById("print-gst-pct").textContent =
    (gstPercentInput.value || "0") + "%";
  const billNoEl = document.getElementById("print-bill-no");
  if (billNoEl) billNoEl.textContent = billId ? billId : "—";
  //window.print();

  // Totals
  document.getElementById("print-total").textContent = formatMoney(
    totalSpan.textContent
  );
  document.getElementById("print-gst").textContent = formatMoney(
    gstAmountSpan.textContent
  );
  document.getElementById("print-grand").textContent = formatMoney(
    grandTotalSpan.textContent
  );
  const grandRounded = Math.round(parseFloat(grandTotalSpan.textContent) || 0);
  const inWordsEl = document.getElementById("print-amount-words");
  if (inWordsEl) inWordsEl.textContent = numberToWords(grandRounded);

  // Body rows
  const tbody = document.getElementById("print-consignment-body");
  if (tbody) {
    tbody.innerHTML = "";
    consignments.forEach((c, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="border:1px solid #222;">${i + 1}</td>
        <td style="border:1px solid #222;">${formatDate(c.date)}</td>
        <td style="border:1px solid #222;">${c.conNo}</td>
        <td style="border:1px solid #222;">${c.consignee}</td>
        <td style="border:1px solid #222;">${c.weight || ""}</td>
        <td style="border:1px solid #222;">${c.destination}</td>
        <td style="border:1px solid #222;">₹${formatMoney(c.amount)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.body.classList.add("print-mode");
  document.getElementById("print-section").style.display = "block";
  window.print();
  setTimeout(() => {
    document.body.classList.remove("print-mode");
    document.getElementById("print-section").style.display = "none";
  }, 200);
}
printBillBtn.addEventListener("click", () => handlePrint());

/*************************************************
 * Consignee / Destination add popups
 *************************************************/
document.getElementById("add-consignee").onclick = () => {
  if (viewingPastBill) return;
  consigneeAddRow.style.display = "block";
  consigneeNewValue.value = "";
  consigneeNewValue.focus();
};
document.getElementById("consignee-cancel").onclick = () => {
  consigneeAddRow.style.display = "none";
};
document.getElementById("consignee-save").onclick = async () => {
  if (viewingPastBill) return;
  const val = consigneeNewValue.value.trim();
  if (!val) return alert("Please enter a valid name.");
  try {
    await window.api.addDropdownValue("consignee", val);
    await fillDropdown("consignee", consigneeSelect);
    consigneeSelect.value = val;
    consigneeAddRow.style.display = "none";
  } catch (err) {
    alert("Error saving consignee: " + err.message);
  }
};

document.getElementById("add-destination").onclick = () => {
  if (viewingPastBill) return;
  destinationAddRow.style.display = "block";
  destinationNewValue.value = "";
  destinationNewValue.focus();
};
document.getElementById("destination-cancel").onclick = () => {
  destinationAddRow.style.display = "none";
};
document.getElementById("destination-save").onclick = async () => {
  if (viewingPastBill) return;
  const val = destinationNewValue.value.trim();
  if (!val) return alert("Please enter a valid destination.");
  try {
    await window.api.addDropdownValue("destination", val);
    await fillDropdown("destination", destinationSelect);
    destinationSelect.value = val;
    destinationAddRow.style.display = "none";
  } catch (err) {
    alert("Error saving destination: " + err.message);
  }
};

/*************************************************
 * Startup
 *************************************************/
window.addEventListener("DOMContentLoaded", async () => {
  initDates();
  fillDropdown("consignee", consigneeSelect);
  fillDropdown("destination", destinationSelect);
  renderTable(); // empty
  calculateTotals();
  conNoInput.focus();
});
document.getElementById("print-bill").addEventListener("click", () => {
  // Show the print section temporarily
  const printSection = document.getElementById("print-section");
  printSection.style.display = "block";

  window.print();

  // Hide it again after printing
  printSection.style.display = "none";
});
