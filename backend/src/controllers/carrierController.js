import { query } from "../configs/db.js";

export const getCarriers = async (req, res, next) => {
  try {
    const sql = `
      SELECT id, carrier_code, name, payload_format, api_endpoint, is_active, created_at
      FROM carriers
      ORDER BY name ASC;
    `;

    const { rows } = await query(sql);

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};