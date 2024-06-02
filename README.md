# VCR.AM SDK

This is the official VCR.AM SDK for TS/JS. It provides a simple way to interact with the VCR.AM API.

## Installation

```bash
npm install @blob-solutions/vcr-am-sdk
```

## Usage

```typescript
import { VCRClient, SaleItem } from "@blob-solutions/vcr-am-sdk";

const VCR_AM_API_KEY = "YOUR_API_KEY";
const VCR_AM_CASHIER_ID = "YOUR_CASHIER_ID";

const vcrClient = new VCRClient(VCR_AM_API_KEY);

const items: SaleItems = [
  // Add your items here
];

const { crn, srcReceiptId } = await vcrClient.registerSale({
  items,
  amount: {
    // Add your amount here
  },
  buyer: {
    type: "individual",
  },
  cashier: {
    id: apiEnv.VCR_AM_CASHIER_ID,
  },
});
```
