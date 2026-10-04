// Справочники: города, районы, учебные заведения (открыты без входа — нужны при регистрации)

import { useQuery } from "@tanstack/react-query";
import { getData } from "@/lib/api";
import type { City, District, Institution, InstitutionType } from "@/types";
import { queryKeys } from "./queryKeys";

const DAY = 24 * 60 * 60_000; // справочники меняются редко

export function useCities() {
  return useQuery({ queryKey: queryKeys.cities, queryFn: () => getData<City[]>("/education/cities"), staleTime: DAY });
}

export function useDistricts(cityId: string) {
  return useQuery({
    queryKey: queryKeys.districts(cityId),
    queryFn: () => getData<District[]>("/education/districts", { cityId }),
    enabled: Boolean(cityId),
    staleTime: DAY,
  });
}

export function useInstitutions(districtId: string, type: InstitutionType | "") {
  return useQuery({
    queryKey: queryKeys.institutions(districtId, type || "school"),
    queryFn: () => getData<Institution[]>("/education/institutions", { districtId, type: type || undefined }),
    enabled: Boolean(districtId && type),
    staleTime: DAY,
  });
}
