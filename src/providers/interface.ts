import type { ProviderReviewRequest, ProviderReviewResponse } from "../types";

export interface ReviewProvider {
  readonly name: string;
  review(request: ProviderReviewRequest): Promise<ProviderReviewResponse>;
}
