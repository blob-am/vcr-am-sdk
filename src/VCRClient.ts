import { fetchWithValidation, simpleFetch } from "simple-typed-fetch";
import { z } from "zod";

import type { SaleData } from "./types";

const API_URL = "https://vcr.am/api/v1";

const saleResponseSchema = z.object({
  urlId: z.string(),
  saleId: z.number(),
  crn: z.string(),
  srcReceiptId: z.number().int(),
  fiscal: z.string(),
});

export default class VCRClient {
  constructor(private readonly apiKey: string) {}

  async registerSale(data: SaleData) {
    const responseData = await simpleFetch(
      async () =>
        await fetchWithValidation(
          `${API_URL}/sales`,
          saleResponseSchema,
          {
            method: "POST",
            headers: {
              "x-api-key": this.apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          },
          z.object({
            error: z.string(),
          })
        )
    )();

    return responseData;
  }
}
