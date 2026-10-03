const state = {
  page: "dashboard",
  currentDate: new Date(),
  calendars: [],
  events: [],
  blocks: [],
  bookings: [],
  dashboard: null
};

const colors = {
  Airbnb: "#ff385c",
  "Booking.com": "#003b95",
  Agoda: "#e91e63",
  Goibibo: "#f97316",
  Direct: "#16a34a",
  Other: "#7c3aed"
};

document.addEventListener(
  "DOMContentLoaded",
  init
);

async function init() {

  setupNavigation();
  setupButtons();
  setupForms();
  setupModals();

  await loadData();

  showPage("dashboard");
}

/* =========================================================
   DATA
========================================================= */

async function loadData() {

  try {

    const [
      eventResponse,
      dashboardResponse
    ] = await Promise.all([
      fetch("/api/events"),
      fetch("/api/dashboard")
    ]);

    const eventData =
      await eventResponse.json();

    state.events =
      eventData.calendars.flatMap(
        c => c.events || []
      );

    state.blocks =
      eventData.blocks || [];

    state.bookings =
      eventData.bookings || [];

    state.calendars =
      await fetch("/api/calendars")
        .then(r => r.json());

    state.dashboard =
      await dashboardResponse.json();

    renderAll();

  } catch (error) {

    console.error(error);

    toast(
      "Unable to load dashboard."
    );

  }
}

/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

  document
    .querySelectorAll(".nav")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.page
          );

        }
      );

    });


  document
    .querySelectorAll(
      "[data-page-link]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          showPage(
            button.dataset.pageLink
          )
      );

    });

}

function showPage(page) {

  state.page = page;

  document
    .querySelectorAll(".page")
    .forEach(section => {

      section.classList.remove(
        "active-page"
      );

    });

  document
    .getElementById(
      `page-${page}`
    )
    .classList.add(
      "active-page"
    );


  document
    .querySelectorAll(".nav")
    .forEach(nav => {

      nav.classList.toggle(
        "active",
        nav.dataset.page === page
      );

    });


  const titles = {

    dashboard: [
      "Dashboard",
      "Property overview"
    ],

    calendar: [
      "Calendar",
      "Manage availability"
    ],

    bookings: [
      "Bookings",
      "All reservations"
    ],

    revenue: [
      "Revenue",
      "Property earnings"
    ],

    reports: [
      "Reports",
      "Performance analysis"
    ],

    connections: [
      "OTA Calendars",
      "Calendar connections and blocks"
    ]

  };


  document.getElementById(
    "pageTitle"
  ).textContent =
    titles[page][0];

  document.getElementById(
    "pageSubtitle"
  ).textContent =
    titles[page][1];


  if (page === "calendar") {
    renderCalendar();
  }

  if (page === "revenue") {
    renderRevenue();
  }

  if (page === "reports") {
    renderReports();
  }

  if (page === "connections") {
    renderConnections();
    renderBlocks();
  }

}

/* =========================================================
   BUTTONS
========================================================= */

function setupButtons() {

  document
    .getElementById(
      "refreshBtn"
    )
    .addEventListener(
      "click",
      async () => {

        toast(
          "Refreshing..."
        );

        await loadData();

        toast(
          "Updated successfully."
        );

      }
    );


  document
    .getElementById(
      "quickBookingBtn"
    )
    .addEventListener(
      "click",
      openBookingModal
    );


  document
    .getElementById(
      "addBookingBtn"
    )
    .addEventListener(
      "click",
      openBookingModal
    );


  document
    .getElementById(
      "addCalendarBtn"
    )
    .addEventListener(
      "click",
      () =>
        openModal(
          "calendarModal"
        )
    );


  document
    .getElementById(
      "blockDateBtn"
    )
    .addEventListener(
      "click",
      () =>
        openModal(
          "blockModal"
        )
    );


  document
    .getElementById(
      "prevMonth"
    )
    .addEventListener(
      "click",
      () => {

        state.currentDate.setMonth(
          state.currentDate.getMonth() - 1
        );

        renderCalendar();

      }
    );


  document
    .getElementById(
      "nextMonth"
    )
    .addEventListener(
      "click",
      () => {

        state.currentDate.setMonth(
          state.currentDate.getMonth() + 1
        );

        renderCalendar();

      }
    );


  document
    .getElementById(
      "todayBtn"
    )
    .addEventListener(
      "click",
      () => {

        state.currentDate =
          new Date();

        renderCalendar();

      }
    );


  document
    .getElementById(
      "clearFilters"
    )
    .addEventListener(
      "click",
      () => {

        document.getElementById(
          "bookingFrom"
        ).value = "";

        document.getElementById(
          "bookingTo"
        ).value = "";

        document.getElementById(
          "bookingPlatformFilter"
        ).value = "all";

        renderBookings();

      }
    );


  [
    "bookingFrom",
    "bookingTo",
    "bookingPlatformFilter"
  ].forEach(id => {

    document
      .getElementById(id)
      .addEventListener(
        "change",
        renderBookings
      );

  });


  document
    .getElementById(
      "runReport"
    )
    .addEventListener(
      "click",
      generateReport
    );

document
  .getElementById("bookingPdfBtn")
  .addEventListener(
    "click",
    downloadBookingPeriodPDF
  );


}

/* =========================================================
   FORMS
========================================================= */

function setupForms() {

  document
    .getElementById(
      "bookingForm"
    )
    .addEventListener(
      "submit",
      saveBooking
    );


  document
    .getElementById(
      "calendarForm"
    )
    .addEventListener(
      "submit",
      saveCalendar
    );


  document
    .getElementById(
      "blockForm"
    )
    .addEventListener(
      "submit",
      saveBlock
    );

}

async function saveBooking(event) {

  event.preventDefault();

  const checkIn =
    value("checkIn");

  const checkOut =
    value("checkOut");

  const data = {

    guest:
      value("guest"),

    platform:
      value("bookingPlatform"),

    checkIn,

    checkOut,

    amount:
      Number(
        value("amount")
      ) || 0,

    status:
      value("bookingStatus")

  };


  try {

    const response =
      await fetch(
        "/api/bookings",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(data)
        }
      );


    const result =
      await response.json();


    if (!response.ok) {
      throw new Error(
        result.error
      );
    }


    closeModal(
      "bookingModal"
    );

    document
      .getElementById(
        "bookingForm"
      )
      .reset();

    await loadData();

    toast(
      "Booking saved."
    );

  } catch (error) {

    toast(
      error.message
    );

  }

}

async function saveCalendar(event) {

  event.preventDefault();

  const data = {

    name:
      value("calendarName"),

    platform:
      value("calendarPlatform"),

    url:
      value("calendarUrl"),

    color:
      value("calendarColor")

  };


  try {

    const response =
      await fetch(
        "/api/calendars",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(data)
        }
      );


    const result =
      await response.json();


    if (!response.ok) {
      throw new Error(
        result.error
      );
    }


    closeModal(
      "calendarModal"
    );

    document
      .getElementById(
        "calendarForm"
      )
      .reset();

    await loadData();

    toast(
      "Calendar connected."
    );

  } catch (error) {

    toast(
      error.message
    );

  }

}

async function saveBlock(event) {

  event.preventDefault();

  let start =
    value("blockStart");

  let end =
    value("blockEnd");


  if (!start || !end) {
    toast(
      "Select both dates."
    );
    return;
  }


  if (start === end) {
    end =
      addDays(
        end,
        1
      );
  }


  if (end < start) {
    toast(
      "Invalid date range."
    );
    return;
  }


  const data = {

    start,

    end,

    reason:
      value("blockReason") ||
      "Manual block"

  };


  try {

    const response =
      await fetch(
        "/api/blocks",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(data)
        }
      );


    const result =
      await response.json();


    if (!response.ok) {
      throw new Error(
        result.error
      );
    }


    closeModal(
      "blockModal"
    );

    document
      .getElementById(
        "blockForm"
      )
      .reset();

    await loadData();

    toast(
      "Dates blocked."
    );

  } catch (error) {

    toast(
      error.message
    );

  }

}

/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

  const d =
    state.dashboard;

  if (!d) return;


  document.getElementById(
    "statBookings"
  ).textContent =
    d.totalBookings;


  document.getElementById(
    "statRevenue"
  ).textContent =
    money(d.totalRevenue);


  document.getElementById(
    "statNights"
  ).textContent =
    d.totalNights;


  document.getElementById(
    "statAverage"
  ).textContent =
    money(d.averageBooking);


  renderChart(
    d.monthly
  );


  renderPlatformSummary(
    d.platforms
  );


  renderRecentBookings();

}

/* =========================================================
   CHART
========================================================= */

function renderChart(monthly) {

  const chart =
    document.getElementById(
      "revenueChart"
    );

  chart.innerHTML = "";


  const entries =
    Object.entries(monthly)
      .sort(
        (a, b) =>
          a[0].localeCompare(b[0])
      )
      .slice(-12);


  if (!entries.length) {

    chart.innerHTML = `
      <div class="empty-state">
        No revenue data yet.
      </div>
    `;

    return;
  }


  const max =
    Math.max(
      ...entries.map(
        ([, data]) =>
          data.revenue
      ),
      1
    );


  entries.forEach(
    ([month, data]) => {

      const bar =
        document.createElement(
          "div"
        );

      bar.className =
        "chart-bar";


      const height =
        Math.max(
          4,
          (data.revenue / max) *
          200
        );


      bar.style.height =
        `${height}px`;


      bar.innerHTML = `

        <strong>
          ${moneyShort(
            data.revenue
          )}
        </strong>

        <span>
          ${month.substring(5)}
        </span>

      `;


      chart.appendChild(
        bar
      );

    }
  );

}

/* =========================================================
   PLATFORM SUMMARY
========================================================= */

function renderPlatformSummary(
  platforms
) {

  const container =
    document.getElementById(
      "platformSummary"
    );

  container.innerHTML = "";


  const entries =
    Object.entries(platforms);


  if (!entries.length) {

    container.innerHTML = `
      <div class="empty-state">
        No bookings yet.
      </div>
    `;

    return;
  }


  entries.forEach(
    ([platform, data]) => {

      const color =
        colors[platform] ||
        "#7c3aed";


      const item =
        document.createElement(
          "div"
        );

      item.className =
        "platform-item";


      item.innerHTML = `

        <div class="platform-name">

          <i
            class="platform-dot"
            style="background:${color}"
          ></i>

          ${escapeHtml(
            platform
          )}

        </div>

        <strong>
          ${data.bookings}
          ·
          ${money(
            data.revenue
          )}
        </strong>

      `;


      container.appendChild(
        item
      );

    }
  );

}

/* =========================================================
   RECENT BOOKINGS
========================================================= */

function renderRecentBookings() {

  const tbody =
    document.getElementById(
      "recentBookings"
    );

  tbody.innerHTML = "";


  const bookings =
    [...state.bookings]
      .sort(
        (a, b) =>
          b.checkIn.localeCompare(
            a.checkIn
          )
      )
      .slice(0, 8);


  if (!bookings.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            No bookings yet.
          </div>
        </td>
      </tr>
    `;

    return;
  }


  bookings.forEach(
    booking => {

      tbody.innerHTML += `

        <tr>

          <td>
            <strong>
              ${escapeHtml(
                booking.guest
              )}
            </strong>
          </td>

          <td>
            ${escapeHtml(
              booking.platform
            )}
          </td>

          <td>
            ${displayDate(
              booking.checkIn
            )}
          </td>

          <td>
            ${displayDate(
              booking.checkOut
            )}
          </td>

          <td>
            ${booking.nights}
          </td>

          <td>
            ${money(
              booking.amount
            )}
          </td>

        </tr>

      `;

    }
  );

}

/* =========================================================
   BOOKINGS
========================================================= */

function renderBookings() {

  const tbody =
    document.getElementById(
      "bookingsTable"
    );

  tbody.innerHTML = "";


  const from =
    value("bookingFrom");

  const to =
    value("bookingTo");

  const platform =
    value(
      "bookingPlatformFilter"
    );


  let bookings =
    [...state.bookings];


  if (from) {

    bookings =
      bookings.filter(
        booking =>
          booking.checkIn >=
          from
      );

  }


  if (to) {

    bookings =
      bookings.filter(
        booking =>
          booking.checkIn <=
          to
      );

  }


  if (
    platform &&
    platform !== "all"
  ) {

    bookings =
      bookings.filter(
        booking =>
          booking.platform ===
          platform
      );

  }


  bookings.sort(
    (a, b) =>
      b.checkIn.localeCompare(
        a.checkIn
      )
  );


  if (!bookings.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            No bookings found.
          </div>
        </td>
      </tr>
    `;

    return;
  }


  bookings.forEach(
    booking => {

      const row =
        document.createElement(
          "tr"
        );


      row.innerHTML = `

        <td>
          <strong>
            ${escapeHtml(
              booking.guest
            )}
          </strong>
        </td>

        <td>
          ${escapeHtml(
            booking.platform
          )}
        </td>

        <td>
          ${displayDate(
            booking.checkIn
          )}
        </td>

        <td>
          ${displayDate(
            booking.checkOut
          )}
        </td>

        <td>
          ${booking.nights}
        </td>

        <td>
          <strong>
            ${money(
              booking.amount
            )}
          </strong>
        </td>

        <td>
          <span class="status">
            ${escapeHtml(
              booking.status
            )}
          </span>
        </td>

     <td>

  <button
    class="delete-btn"
    title="Delete booking"
  >
    ×
  </button>

</td>

      `;


      row
        .querySelector(
          ".delete-btn"
        )
        .addEventListener(
          "click",
          () =>
            deleteBooking(
              booking.id
            )
        );


      tbody.appendChild(
        row
      );

    }
  );

}

async function deleteBooking(id) {

  if (
    !confirm(
      "Delete this booking?"
    )
  ) {
    return;
  }


  await fetch(
    `/api/bookings/${id}`,
    {
      method: "DELETE"
    }
  );


  await loadData();

  toast(
    "Booking deleted."
  );

}

/* =========================================================
   PDF DOWNLOAD
========================================================= */

function downloadBookingPDF(id) {

  window.open(
    `/api/bookings/${encodeURIComponent(id)}/pdf`,
    "_blank"
  );

}

/* =========================================================
   BOOKING PERIOD PDF
========================================================= */

function downloadBookingPeriodPDF() {

  const from =
    value("bookingFrom");

  const to =
    value("bookingTo");

  const platform =
    value("bookingPlatformFilter");


  if (!from || !to) {

    toast(
      "Please select From and To dates."
    );

    return;
  }


  if (to < from) {

    toast(
      "Invalid date range."
    );

    return;
  }


  const params =
    new URLSearchParams();

  params.append(
    "from",
    from
  );

  params.append(
    "to",
    to
  );


  if (
    platform &&
    platform !== "all"
  ) {

    params.append(
      "platform",
      platform
    );

  }


  window.open(
    `/api/bookings/pdf?${params.toString()}`,
    "_blank"
  );

}


/* =========================================================
   CALENDAR
========================================================= */

function renderCalendar() {

  const grid =
    document.getElementById(
      "calendarGrid"
    );

  const title =
    document.getElementById(
      "monthTitle"
    );


  grid.innerHTML = "";


  const year =
    state.currentDate.getFullYear();

  const month =
    state.currentDate.getMonth();


  title.textContent =
    state.currentDate.toLocaleString(
      "en-IN",
      {
        month: "long",
        year: "numeric"
      }
    );


  const first =
    new Date(
      year,
      month,
      1
    ).getDay();


  const days =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  for (
    let i = 0;
    i < first;
    i++
  ) {

    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "day empty";

    grid.appendChild(
      empty
    );

  }


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    const date =
      new Date(
        year,
        month,
        day
      );

    const dateString =
      formatDate(date);


    const cell =
      document.createElement(
        "div"
      );

    cell.className =
      "day";


    if (
      dateString ===
      formatDate(
        new Date()
      )
    ) {

      cell.classList.add(
        "today"
      );

    }


    const otaEvents =
      state.events.filter(
        event =>
          event.dates.includes(
            dateString
          )
      );


    const block =
      state.blocks.find(
        b =>
          dateString >=
            b.start &&
          dateString <
            b.end
      );


    if (otaEvents.length) {
      cell.classList.add(
        "booking"
      );
    }

    if (block) {
      cell.classList.add(
        "manual"
      );
    }


    cell.innerHTML = `

      <div class="day-number">
        ${day}
      </div>

      <div class="day-events"></div>

    `;


    const eventsContainer =
      cell.querySelector(
        ".day-events"
      );


    otaEvents
      .slice(0, 3)
      .forEach(
        event => {

          const el =
            document.createElement(
              "div"
            );

          el.className =
            "event";

          el.style.background =
            event.color ||
            "#2563eb";

          el.textContent =
            event.platform;

          el.title =
            `${event.platform}: ${event.title}`;

          eventsContainer.appendChild(
            el
          );

        }
      );


    if (block) {

      const el =
        document.createElement(
          "div"
        );

      el.className =
        "event";

      el.style.background =
        "#f59e0b";

      el.textContent =
        "Manual Block";

      eventsContainer.appendChild(
        el
      );

    }


    cell.addEventListener(
      "click",
      () => {

        if (block) {

          if (
            confirm(
              "Remove this manual block?"
            )
          ) {

            deleteBlock(
              block.id
            );

          }

        } else {

          document.getElementById(
            "blockStart"
          ).value =
            dateString;

          document.getElementById(
            "blockEnd"
          ).value =
            dateString;

          openModal(
            "blockModal"
          );

        }

      }
    );


    grid.appendChild(
      cell
    );

  }


  renderLegend();

}

/* =========================================================
   LEGEND
========================================================= */

function renderLegend() {

  const legend =
    document.getElementById(
      "calendarLegend"
    );

  legend.innerHTML = "";


  state.calendars.forEach(
    calendar => {

      legend.innerHTML += `

        <span class="legend-item">

          <i
            class="legend-dot"
            style="background:${calendar.color}"
          ></i>

          ${escapeHtml(
            calendar.platform
          )}

        </span>

      `;

    }
  );


  legend.innerHTML += `

    <span class="legend-item">

      <i
        class="legend-dot"
        style="background:#f59e0b"
      ></i>

      Manual Block

    </span>

  `;

}

/* =========================================================
   REVENUE
========================================================= */

function renderRevenue() {

  const d =
    state.dashboard;

  if (!d) return;


  document.getElementById(
    "revenueTotal"
  ).textContent =
    money(
      d.totalRevenue
    );


  document.getElementById(
    "revenueBookings"
  ).textContent =
    d.totalBookings;


  document.getElementById(
    "revenueNights"
  ).textContent =
    d.totalNights;


  const tbody =
    document.getElementById(
      "monthlyRevenueTable"
    );

  tbody.innerHTML = "";


  const entries =
    Object.entries(
      d.monthly
    )
      .sort(
        (a, b) =>
          b[0].localeCompare(
            a[0]
          )
      );


  if (!entries.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            No revenue data.
          </div>
        </td>
      </tr>
    `;

    return;

  }


  entries.forEach(
    ([month, data]) => {

      const average =
        data.bookings
          ? data.revenue /
            data.bookings
          : 0;


      tbody.innerHTML += `

        <tr>

          <td>
            ${month}
          </td>

          <td>
            ${data.bookings}
          </td>

          <td>
            ${data.nights}
          </td>

          <td>
            <strong>
              ${money(
                data.revenue
              )}
            </strong>
          </td>

          <td>
            ${money(
              average
            )}
          </td>

        </tr>

      `;

    }
  );

}

/* =========================================================
   REPORTS
========================================================= */

function generateReport() {

  const from =
    value("reportFrom");

  const to =
    value("reportTo");


  if (!from || !to) {

    toast(
      "Select both dates."
    );

    return;

  }


  if (to < from) {

    toast(
      "Invalid date range."
    );

    return;

  }


  const bookings =
    state.bookings.filter(
      booking =>
        booking.checkIn >=
          from &&
        booking.checkIn <=
          to
    );


  const total =
    bookings.reduce(
      (sum, booking) =>
        sum +
        Number(
          booking.amount
        ),
      0
    );


  const nights =
    bookings.reduce(
      (sum, booking) =>
        sum +
        Number(
          booking.nights
        ),
      0
    );


  const average =
    bookings.length
      ? total /
        bookings.length
      : 0;


  const platformTotals = {};


  bookings.forEach(
    booking => {

      if (
        !platformTotals[
          booking.platform
        ]
      ) {

        platformTotals[
          booking.platform
        ] = 0;

      }

      platformTotals[
        booking.platform
      ] += Number(
        booking.amount
      );

    }
  );


  let platformHTML = "";


  Object.entries(
    platformTotals
  ).forEach(
    ([platform, amount]) => {

      platformHTML += `

        <div class="report-card">

          <span>
            ${escapeHtml(
              platform
            )}
          </span>

          <strong>
            ${money(
              amount
            )}
          </strong>

        </div>

      `;

    }
  );


  document.getElementById(
    "reportResult"
  ).innerHTML = `

    <div class="report-cards">

      <div class="report-card">

        <span>Bookings</span>

        <strong>
          ${bookings.length}
        </strong>

      </div>

      <div class="report-card">

        <span>Revenue</span>

        <strong>
          ${money(total)}
        </strong>

      </div>

      <div class="report-card">

        <span>Nights</span>

        <strong>
          ${nights}
        </strong>

      </div>

      <div class="report-card">

        <span>Average Booking</span>

        <strong>
          ${money(average)}
        </strong>

      </div>

    </div>

    <div
      class="report-cards"
      style="margin-top:15px"
    >

      ${platformHTML}

    </div>

  `;

}

/* =========================================================
   CONNECTIONS
========================================================= */

function renderConnections() {

  const container =
    document.getElementById(
      "connectionsList"
    );

  container.innerHTML = "";


  if (!state.calendars.length) {

    container.innerHTML = `
      <div class="empty-state">
        No OTA calendars connected.
      </div>
    `;

    return;
  }


  state.calendars.forEach(
    calendar => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "connection";


      item.innerHTML = `

        <div class="connection-main">

          <i
            class="connection-color"
            style="background:${calendar.color}"
          ></i>

          <div>

            <strong>
              ${escapeHtml(
                calendar.name
              )}
            </strong>

            <small>
              ${escapeHtml(
                calendar.platform
              )}
            </small>

          </div>

        </div>

        <button
          class="delete-btn"
        >
          ×
        </button>

      `;


      item
        .querySelector(
          ".delete-btn"
        )
        .addEventListener(
          "click",
          () =>
            deleteCalendar(
              calendar.id
            )
        );


      container.appendChild(
        item
      );

    }
  );

}

function renderBlocks() {

  const container =
    document.getElementById(
      "blocksList"
    );

  container.innerHTML = "";


  if (!state.blocks.length) {

    container.innerHTML = `
      <div class="empty-state">
        No manual blocks.
      </div>
    `;

    return;
  }


  state.blocks.forEach(
    block => {

      const displayEnd =
        addDays(
          block.end,
          -1
        );


      const item =
        document.createElement(
          "div"
        );

      item.className =
        "block";


      item.innerHTML = `

        <div class="block-main">

          <i
            class="connection-color"
            style="background:#f59e0b"
          ></i>

          <div>

            <strong>
              ${displayDate(
                block.start
              )}
              —
              ${displayDate(
                displayEnd
              )}
            </strong>

            <small>
              ${escapeHtml(
                block.reason
              )}
            </small>

          </div>

        </div>

        <button
          class="delete-btn"
        >
          ×
        </button>

      `;


      item
        .querySelector(
          ".delete-btn"
        )
        .addEventListener(
          "click",
          () =>
            deleteBlock(
              block.id
            )
        );


      container.appendChild(
        item
      );

    }
  );

}

async function deleteCalendar(id) {

  if (
    !confirm(
      "Remove this calendar?"
    )
  ) {
    return;
  }


  await fetch(
    `/api/calendars/${id}`,
    {
      method: "DELETE"
    }
  );


  await loadData();

  toast(
    "Calendar removed."
  );

}

async function deleteBlock(id) {

  await fetch(
    `/api/blocks/${id}`,
    {
      method: "DELETE"
    }
  );


  await loadData();

  toast(
    "Block removed."
  );

}

/* =========================================================
   MODALS
========================================================= */

function setupModals() {

  document
    .querySelectorAll(
      "[data-close]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          closeModal(
            button.dataset.close
          )
      );

    });


  document
    .querySelectorAll(
      ".modal-overlay"
    )
    .forEach(overlay => {

      overlay.addEventListener(
        "click",
        event => {

          if (
            event.target ===
            overlay
          ) {

            overlay.classList.remove(
              "show"
            );

          }

        }
      );

    });


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Escape"
      ) {

        document
          .querySelectorAll(
            ".modal-overlay.show"
          )
          .forEach(
            modal =>
              modal.classList.remove(
                "show"
              )
          );

      }

    }
  );

}

function openBookingModal() {

  document
    .getElementById(
      "bookingForm"
    )
    .reset();

  openModal(
    "bookingModal"
  );

}

function openModal(id) {

  document
    .getElementById(id)
    .classList.add(
      "show"
    );

}

function closeModal(id) {

  document
    .getElementById(id)
    .classList.remove(
      "show"
    );

}

/* =========================================================
   HELPERS
========================================================= */

function value(id) {

  return document
    .getElementById(id)
    .value;

}

function formatDate(date) {

  const d =
    new Date(date);

  return (
    d.getFullYear() +
    "-" +
    String(
      d.getMonth() + 1
    ).padStart(2, "0") +
    "-" +
    String(
      d.getDate()
    ).padStart(2, "0")
  );

}

function addDays(dateString, days) {

  const d =
    new Date(
      `${dateString}T00:00:00`
    );

  d.setDate(
    d.getDate() + days
  );

  return formatDate(d);

}

function displayDate(date) {

  if (!date) return "-";

  return new Date(
    `${date}T00:00:00`
  ).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );

}

function money(amount) {

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }
  ).format(
    Number(amount) || 0
  );

}

function moneyShort(amount) {

  amount =
    Number(amount) || 0;

  if (amount >= 100000) {
    return (
      "₹" +
      (amount / 100000)
        .toFixed(1) +
      "L"
    );
  }

  if (amount >= 1000) {
    return (
      "₹" +
      (amount / 1000)
        .toFixed(1) +
      "K"
    );
  }

  return "₹" + amount;

}

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}

function toast(message) {

  const el =
    document.getElementById(
      "toast"
    );

  el.textContent =
    message;

  el.classList.add(
    "show"
  );


  clearTimeout(
    window.toastTimer
  );


  window.toastTimer =
    setTimeout(
      () => {

        el.classList.remove(
          "show"
        );

      },
      3000
    );

}

/* =========================================================
   GLOBAL RENDER
========================================================= */

function renderAll() {

  renderDashboard();

  renderBookings();

  renderCalendar();

  renderRevenue();

  renderConnections();

  renderBlocks();

}