import { fetchWithValidation, simpleFetch } from "simple-typed-fetch";
import { z } from "zod";

import type { Language, SaleData } from "./types";

const API_URL = "https://vcr.am/api/v1";

const saleResponseSchema = z.object({
  urlId: z.string(),
  saleId: z.number(),
  crn: z.string(),
  srcReceiptId: z.number().int(),
  fiscal: z.string(),
});

const errorResponseSchema = z.object({
  error: z.string(),
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
          errorResponseSchema
        )
    )();

    return responseData;
  }

  async searchClassifierCategory(
    query: string,
    type: "product" | "service",
    language: Language
  ) {
    const url = new URL(`${API_URL}/searchClassifier`);
    url.searchParams.append("query", query);
    url.searchParams.append("type", type);
    url.searchParams.append("language", language);

    return await simpleFetch(
      async () =>
        await fetchWithValidation(
          url.toString(),
          z.array(z.object({ code: z.string(), title: z.string() })),
          {
            method: "GET",
            headers: {
              "x-api-key": this.apiKey,
              "Content-Type": "application/json",
            },
          },
          errorResponseSchema
        )
    )();
  }
}
