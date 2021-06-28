const db = require("../db")
const { BadRequestError, NotFoundError } = require("../utils/errors")

class Booking {
  static async createBooking(newBooking, listing, user) {
    if (!newBooking.startDate || !newBooking.endDate) {
      throw new BadRequestError(`Missing startDate or endDate`)
    }

    const userId = await db.query(`
      SELECT id 
      FROM users
      WHERE username = $1
      `, [user.username]
      )
    const results = await db.query(`
      INSERT INTO bookings (user_id, listing_id, payment_method, start_date, end_date, guests, total_cost)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_id as "userId", listing_id as "listingId",
      (
        SELECT username
        FROM users
        WHERE id = user_id
      ) AS "username",
      (
        SELECT users.username
        FROM users
        WHERE users.id = 
        (
          SELECT listings.user_id
          FROM listings
          WHERE listings.id = listing_id
        )
      ) AS "hostUsername",
      start_date as "startDate", end_date as "endDate", guests, total_cost as "totalCost", created_at as "createdAt", payment_method as "paymentMethod"
      `, 
      [userId.rows[0].id,
       listing.id,
       newBooking.paymentMethod || "card", 
       new Date(newBooking.startDate), 
       new Date(newBooking.endDate), 
       newBooking.guests || 1, 
       Math.ceil((listing.price * 1.1) * (new Date(newBooking.endDate) - new Date(newBooking.startDate) + 1))
      ]
    )

    return results.rows[0]
  }

  static async fetchBookingById(bookingId) {
    // fetch a single booking by its id
    const results = await db.query(
      `
      SELECT id,
             payment_method AS "paymentMethod",
             start_date AS "startDate",
             end_date AS "endDate",
             guests,
             total_cost AS "totalCost",
             listing_id AS "listingId",
             user_id AS "userId",
             -- subquery to select the username
             -- of the user who is making the booking
             (
               SELECT username
               FROM users
               WHERE id = user_id
             ) AS "username",
             -- nested subquery to select the username
             -- of the host user who owns the listing
             (
               SELECT users.username
               FROM users
               WHERE users.id = (
                 SELECT listings.user_id
                 FROM listings
                 WHERE listings.id = listing_id
               )
             ) AS "hostUsername",
             created_at AS "createdAt"
      FROM bookings
      WHERE id = $1;
      `,
      [bookingId]
    )

    const booking = results.rows[0]

    if (booking) return booking

    throw new NotFoundError("No booking found with that id.")
  }

  static async listBookingsFromUser(user) {
    // list all bookings that the user has created
    const results = await db.query(
      `
      SELECT bookings.id,
            bookings.payment_method AS "paymentMethod",
            bookings.start_date AS "startDate",
            bookings.end_date AS "endDate",
            bookings.guests,
            bookings.total_cost AS "totalCost",
            bookings.listing_id AS "listingId",
            bookings.user_id AS "userId",
            users.username AS "username",
            (
              SELECT hostUsers.username
              FROM users AS hostUsers
              WHERE hostUsers.id = (
                SELECT listings.user_id
                FROM listings
                WHERE listings.id = listing_id
              )
            ) AS "hostUsername",            
            bookings.created_at AS "createdAt"
      FROM bookings
        JOIN users ON users.id = bookings.user_id
      WHERE user_id = (SELECT id FROM users WHERE username = $1)
      ORDER BY bookings.created_at DESC;
      `,
      [user.username]
    )

    return results.rows
  }

  static async listBookingsForUserListings(user) {
    // list all bookings created for any of the listings that a user owns
    const results = await db.query(
      `
      SELECT bookings.id,
             bookings.payment_method AS "paymentMethod",
             bookings.start_date AS "startDate",
             bookings.end_date AS "endDate",
             bookings.guests,
             bookings.total_cost AS "totalCost",
             bookings.listing_id AS "listingId",
             bookings.user_id AS "userId",
             users.username AS "username",
             (
              SELECT hostUsers.username
              FROM users AS hostUsers
              WHERE hostUsers.id = (
                SELECT listings.user_id
                FROM listings
                WHERE listings.id = listing_id
              )
             ) AS "hostUsername",
             bookings.created_at AS "createdAt"
      FROM bookings
        JOIN users ON users.id = bookings.user_id
        JOIN listings ON listings.id = bookings.listing_id
      WHERE listings.user_id = (SELECT id FROM users WHERE username = $1)
      ORDER BY bookings.created_at DESC;
      `,
      [user.username]
    )

    return results.rows
  }
}

module.exports = Booking
