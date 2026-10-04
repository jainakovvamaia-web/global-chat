import { z } from "zod";
import { institutionTypeSchema, slugId } from "./common.validators";

export const districtsQuery = z.object({ cityId: slugId.optional() });

export const institutionsQuery = z.object({
  cityId: slugId.optional(),
  districtId: slugId.optional(),
  type: institutionTypeSchema.optional(),
});

export const cityDistrictsParams = z.object({ cityId: slugId });
