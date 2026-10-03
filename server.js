const PDFDocument = require("pdfkit");
const express = require("express");
const ical = require("ical");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =========================================================
   DATABASE
========================================================= */

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "database.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultDatabase = {
  calendars: [],
  blocks: [],
  bookings: []
};

function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(defaultDatabase, null, 2)
      );

      return structuredClone(defaultDatabase);
    }

    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    return {
      calendars: data.calendars || [],
      blocks: data.blocks || [],
      bookings: data.bookings || []
    };

  } catch (error) {
    console.error("Database read error:", error);

    return structuredClone(defaultDatabase);
  }
}

let db = loadDatabase();

function saveDatabase() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(db, null, 2)
  );
}

/* =========================================================
   HELPERS
========================================================= */

function createId(prefix) {
  return (
    prefix +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random()
      .toString(36)
      .substring(2, 8)
  );
}

function formatDate(date) {
  const d = new Date(date);

  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function addDays(dateString, amount) {
  const date = new Date(
    `${dateString}T00:00:00`
  );

  date.setDate(
    date.getDate() + amount
  );

  return formatDate(date);
}

function getNights(start, end) {
  const a = new Date(
    `${start}T00:00:00`
  );

  const b = new Date(
    `${end}T00:00:00`
  );

  return Math.max(
    0,
    Math.round(
      (b - a) / 86400000
    )
  );
}

function expandDates(start, end) {
  const dates = [];

  let current = new Date(
    `${start}T00:00:00`
  );

  const final = new Date(
    `${end}T00:00:00`
  );

  while (current < final) {
    dates.push(formatDate(current));

    current.setDate(
      current.getDate() + 1
    );
  }

  return dates;
}

/* =========================================================
   PDF HELPERS
========================================================= */

function money(value) {
  return (
    "₹" +
    Number(value || 0).toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    )
  );
}

function formatPDFDate(date) {
  if (!date) return "-";

  const d = new Date(
    date + "T00:00:00"
  );

  return d.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}

function bookingRate(booking) {
  const nights = getNights(
    booking.checkIn,
    booking.checkOut
  );

  if (!nights) {
    return Number(
      booking.amount || 0
    );
  }

  return (
    Number(
      booking.amount || 0
    ) / nights
  );
}

/* =========================================================
   CALENDARS
========================================================= */

app.get("/api/calendars", (req, res) => {
  res.json(db.calendars);
});

app.post("/api/calendars", (req, res) => {

  const {
    name,
    platform,
    url,
    color
  } = req.body;

  if (!name || !url) {
    return res.status(400).json({
      error:
        "Calendar name and URL are required."
    });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({
      error:
        "Invalid calendar URL."
    });
  }

  const calendar = {
    id: createId("cal"),

    name: name.trim(),

    platform:
      platform || "Other",

    url: url.trim(),

    color:
      color || "#2563eb",

    createdAt:
      new Date().toISOString()
  };

  db.calendars.push(calendar);

  saveDatabase();

  res.status(201).json(calendar);
});

app.delete(
  "/api/calendars/:id",
  (req, res) => {

    db.calendars =
      db.calendars.filter(
        c =>
          c.id !== req.params.id
      );

    saveDatabase();

    res.json({
      success: true
    });
  }
);

/* =========================================================
   ICAL FETCH
========================================================= */

async function fetchIcalCalendar(calendar) {

  try {

    const response = await fetch(
      calendar.url,
      {
        headers: {
          "User-Agent":
            "PropertyCalendarManager/2.0"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const text =
      await response.text();

    const parsed =
      ical.parseICS(text);

    const events = [];

    Object.keys(parsed).forEach(
      key => {

        const item =
          parsed[key];

        if (
          item.type !== "VEVENT" ||
          !item.start ||
          !item.end
        ) {
          return;
        }

        const start =
          formatDate(
            item.start
          );

        const end =
          formatDate(
            item.end
          );

        events.push({

          id:
            calendar.id +
            "-" +
            key,

          calendarId:
            calendar.id,

          calendarName:
            calendar.name,

          platform:
            calendar.platform,

          color:
            calendar.color,

          title:
            item.summary ||
            `${calendar.platform} Booking`,

          start,

          end,

          nights:
            getNights(
              start,
              end
            ),

          dates:
            expandDates(
              start,
              end
            )
        });

      }
    );

    return {
      calendarId:
        calendar.id,

      events
    };

  } catch (error) {

    console.error(
      `iCal error - ${calendar.name}:`,
      error.message
    );

    return {
      calendarId:
        calendar.id,

      events: [],

      error:
        error.message
    };
  }
}

app.get(
  "/api/events",
  async (req, res) => {

    const results = [];

    for (
      const calendar
      of db.calendars
    ) {

      results.push(
        await fetchIcalCalendar(
          calendar
        )
      );

    }

    res.json({

      calendars:
        results,

      blocks:
        db.blocks,

      bookings:
        db.bookings

    });
  }
);

/* =========================================================
   MANUAL BLOCKS
========================================================= */

app.get(
  "/api/blocks",
  (req, res) => {
    res.json(db.blocks);
  }
);

app.post(
  "/api/blocks",
  (req, res) => {

    let {
      start,
      end,
      reason
    } = req.body;

    if (!start || !end) {

      return res.status(400).json({
        error:
          "Start and end dates are required."
      });

    }

    if (start === end) {
      end =
        addDays(
          end,
          1
        );
    }

    if (end < start) {

      return res.status(400).json({
        error:
          "Invalid date range."
      });

    }

    const block = {

      id:
        createId("block"),

      start,

      end,

      reason:
        reason ||
        "Manual block",

      createdAt:
        new Date().toISOString()

    };

    db.blocks.push(block);

    saveDatabase();

    res.status(201).json(
      block
    );
  }
);

app.delete(
  "/api/blocks/:id",
  (req, res) => {

    db.blocks =
      db.blocks.filter(
        block =>
          block.id !==
          req.params.id
      );

    saveDatabase();

    res.json({
      success: true
    });
  }
);

/* =========================================================
   BOOKINGS
========================================================= */

app.get(
  "/api/bookings",
  (req, res) => {
    res.json(db.bookings);
  }
);

app.post(
  "/api/bookings",
  (req, res) => {

    const {
      guest,
      platform,
      checkIn,
      checkOut,
      amount,
      status
    } = req.body;

    if (
      !guest ||
      !checkIn ||
      !checkOut
    ) {

      return res.status(400).json({
        error:
          "Guest, check-in and check-out are required."
      });

    }

    const nights =
      getNights(
        checkIn,
        checkOut
      );

    if (nights <= 0) {

      return res.status(400).json({
        error:
          "Check-out must be after check-in."
      });

    }

    const booking = {

      id:
        createId("booking"),

      guest:
        guest.trim(),

      platform:
        platform ||
        "Direct",

      checkIn,

      checkOut,

      nights,

      amount:
        Number(amount) || 0,

      status:
        status ||
        "Confirmed",

      createdAt:
        new Date().toISOString()

    };

    db.bookings.push(
      booking
    );

    saveDatabase();

    res.status(201).json(
      booking
    );
  }
);

app.put(
  "/api/bookings/:id",
  (req, res) => {

    const booking =
      db.bookings.find(
        b =>
          b.id ===
          req.params.id
      );

    if (!booking) {

      return res.status(404).json({
        error:
          "Booking not found."
      });

    }

    Object.assign(
      booking,
      req.body
    );

    if (
      booking.checkIn &&
      booking.checkOut
    ) {

      booking.nights =
        getNights(
          booking.checkIn,
          booking.checkOut
        );

    }

    booking.amount =
      Number(
        booking.amount
      ) || 0;

    saveDatabase();

    res.json(
      booking
    );
  }
);

app.delete(
  "/api/bookings/:id",
  (req, res) => {

    db.bookings =
      db.bookings.filter(
        b =>
          b.id !==
          req.params.id
      );

    saveDatabase();

    res.json({
      success: true
    });
  }
);

/* =========================================================
   DASHBOARD SUMMARY
========================================================= */

app.get(
  "/api/dashboard",
  (req, res) => {

    const bookings =
      db.bookings;

    const totalBookings =
      bookings.length;

    const totalRevenue =
      bookings.reduce(
        (sum, booking) =>
          sum +
          Number(
            booking.amount || 0
          ),
        0
      );

    const totalNights =
      bookings.reduce(
        (sum, booking) =>
          sum +
          Number(
            booking.nights || 0
          ),
        0
      );

    const averageBooking =
      totalBookings
        ? totalRevenue /
          totalBookings
        : 0;

    const platforms = {};

    bookings.forEach(
      booking => {

        if (
          !platforms[
            booking.platform
          ]
        ) {

          platforms[
            booking.platform
          ] = {

            bookings: 0,

            revenue: 0,

            nights: 0

          };

        }

        platforms[
          booking.platform
        ].bookings++;

        platforms[
          booking.platform
        ].revenue +=
          Number(
            booking.amount || 0
          );

        platforms[
          booking.platform
        ].nights +=
          Number(
            booking.nights || 0
          );

      }
    );

    const monthly = {};

    bookings.forEach(
      booking => {

        const month =
          booking.checkIn
            .substring(
              0,
              7
            );

        if (!monthly[month]) {

          monthly[month] = {

            bookings: 0,

            revenue: 0,

            nights: 0

          };

        }

        monthly[
          month
        ].bookings++;

        monthly[
          month
        ].revenue +=
          Number(
            booking.amount || 0
          );

        monthly[
          month
        ].nights +=
          Number(
            booking.nights || 0
          );

      }
    );

    res.json({

      totalBookings,

      totalRevenue,

      totalNights,

      averageBooking,

      platforms,

      monthly

    });
  }
);

/* =========================================================
   BOOKING PERIOD PDF
   - Generates ONE PDF for selected period
   - Optional platform filter
   - No individual booking PDF
========================================================= */

app.get(
  "/api/bookings/pdf",
  (req, res) => {

    try {

      const from =
        req.query.from;

      const to =
        req.query.to;

      const platform =
        req.query.platform ||
        "all";


      /* -----------------------------------------------------
         VALIDATE DATES
      ----------------------------------------------------- */

      if (!from || !to) {

        return res
          .status(400)
          .send(
            "From and To dates are required."
          );

      }

      if (to < from) {

        return res
          .status(400)
          .send(
            "Invalid date range."
          );

      }


      /* -----------------------------------------------------
         FILTER BOOKINGS
      ----------------------------------------------------- */

      let bookings =
        [...db.bookings];


      bookings =
        bookings.filter(
          booking =>

            booking.checkIn >=
              from &&

            booking.checkIn <=
              to
        );


      /* -----------------------------------------------------
         PLATFORM FILTER
      ----------------------------------------------------- */

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


      /* -----------------------------------------------------
         SORT
      ----------------------------------------------------- */

      bookings.sort(
        (a, b) =>
          new Date(
            a.checkIn
          ) -
          new Date(
            b.checkIn
          )
      );


      /* -----------------------------------------------------
         CALCULATE SUMMARY
      ----------------------------------------------------- */

      const totalBookings =
        bookings.length;


      const totalNights =
        bookings.reduce(
          (sum, booking) =>
            sum +
            getNights(
              booking.checkIn,
              booking.checkOut
            ),
          0
        );


      const totalRevenue =
        bookings.reduce(
          (sum, booking) =>
            sum +
            Number(
              booking.amount || 0
            ),
          0
        );


      const averageBooking =
        totalBookings
          ? totalRevenue /
            totalBookings
          : 0;


      /* -----------------------------------------------------
         CREATE PDF
      ----------------------------------------------------- */

      const doc =
        new PDFDocument({
          size: "A4",
          margin: 35
        });


      res.setHeader(
        "Content-Type",
        "application/pdf"
      );


      res.setHeader(
        "Content-Disposition",
        'attachment; filename="booking-report.pdf"'
      );


      doc.pipe(res);


      /* =====================================================
         TITLE
      ===================================================== */

      doc
        .fontSize(22)
        .font("Helvetica-Bold")
        .text(
          "BOOKING REPORT",
          {
            align: "center"
          }
        );


      doc
        .moveDown(0.3)
        .fontSize(10)
        .font("Helvetica")
        .text(
          `${formatPDFDate(from)}  →  ${formatPDFDate(to)}`,
          {
            align: "center"
          }
        );


      doc
        .moveDown(0.3)
        .fontSize(9)
        .text(
          `Platform: ${
            platform === "all"
              ? "All Platforms"
              : platform
          }`,
          {
            align: "center"
          }
        );


      doc.moveDown(1);


      /* =====================================================
         SUMMARY
      ===================================================== */

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(
          `Total Bookings: ${totalBookings}`
        );


      doc.text(
        `Total Nights: ${totalNights}`
      );


      doc.text(
        `Total Revenue: ${money(
          totalRevenue
        )}`
      );


      doc.text(
        `Average Booking: ${money(
          averageBooking
        )}`
      );


      doc.moveDown(1);


      /* =====================================================
         TABLE HEADER FUNCTION
      ===================================================== */

      function drawTableHeader() {

        const tableTop =
          doc.y;


        doc
          .fontSize(8)
          .font("Helvetica-Bold");


        doc.text(
          "Guest",
          35,
          tableTop
        );


        doc.text(
          "Platform",
          125,
          tableTop
        );


        doc.text(
          "Check-in",
          205,
          tableTop
        );


        doc.text(
          "Check-out",
          275,
          tableTop
        );


        doc.text(
          "Nights",
          350,
          tableTop
        );


        doc.text(
          "Rate/Night",
          395,
          tableTop
        );


        doc.text(
          "Total",
          480,
          tableTop
        );


        doc
          .moveTo(
            35,
            tableTop + 15
          )
          .lineTo(
            560,
            tableTop + 15
          )
          .stroke();


        return (
          tableTop + 25
        );
      }


      let y =
        drawTableHeader();


      /* =====================================================
         BOOKINGS TABLE
      ===================================================== */

      bookings.forEach(
        booking => {

          /*
             Create a new page when
             there is not enough space.
          */

          if (y > 735) {

            doc.addPage();

            y = 50;

            y =
              drawTableHeader();

          }


          const nights =
            getNights(
              booking.checkIn,
              booking.checkOut
            );


          const rate =
            nights > 0

              ? Number(
                  booking.amount || 0
                ) / nights

              : Number(
                  booking.amount || 0
                );


          doc
            .fontSize(7)
            .font("Helvetica");


          /* Guest */

          doc.text(
            String(
              booking.guest || "-"
            ).substring(
              0,
              18
            ),
            35,
            y,
            {
              width: 85
            }
          );


          /* Platform */

          doc.text(
            String(
              booking.platform ||
              "-"
            ).substring(
              0,
              13
            ),
            125,
            y,
            {
              width: 75
            }
          );


          /* Check-in */

          doc.text(
            formatPDFDate(
              booking.checkIn
            ),
            205,
            y
          );


          /* Check-out */

          doc.text(
            formatPDFDate(
              booking.checkOut
            ),
            275,
            y
          );


          /* Nights */

          doc.text(
            String(nights),
            350,
            y
          );


          /* Rate */

          doc.text(
            money(rate),
            395,
            y
          );


          /* Total */

          doc.text(
            money(
              booking.amount
            ),
            480,
            y
          );


          y += 30;

        }
      );


      /* =====================================================
         NO BOOKINGS MESSAGE
      ===================================================== */

      if (
        bookings.length === 0
      ) {

        doc
          .fontSize(10)
          .font("Helvetica")
          .text(
            "No bookings found for the selected period.",
            35,
            y + 10
          );

        y += 40;

      }


      /* =====================================================
         TOTAL REVENUE
      ===================================================== */

      if (y > 735) {

        doc.addPage();

        y = 60;

      }


      doc
        .moveTo(
          35,
          y + 5
        )
        .lineTo(
          560,
          y + 5
        )
        .stroke();


      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(
          `TOTAL REVENUE: ${money(
            totalRevenue
          )}`,
          35,
          y + 18
        );


      /* =====================================================
         FOOTER
      ===================================================== */

      doc
        .fontSize(8)
        .font("Helvetica")
        .text(
          `Generated on ${new Date().toLocaleDateString(
            "en-IN"
          )}`,
          35,
          790
        );


      doc.end();


    } catch (error) {

      console.error(
        "Booking report PDF error:",
        error
      );

      if (!res.headersSent) {

        res
          .status(500)
          .send(
            "Could not generate booking report PDF."
          );

      }

    }

  }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      `Property Management Dashboard running at http://localhost:${PORT}`
    );

  }
);