// Справочники: города, районы, учебные заведения

import { supabaseAdmin } from "../config/supabase";
import type { CityDto, DistrictDto, InstitutionDto } from "../types/dto";
import type { DistrictRow, InstitutionRow, InstitutionType } from "../types/database.types";
import { apiErrors } from "../utils/apiErrors";
import { maybe, must } from "../utils/db";
import type { LocationInput } from "../validators/auth.validators";

const toDistrict = (row: DistrictRow): DistrictDto => ({ id: row.id, cityId: row.city_id, name: row.name });

const toInstitution = (row: InstitutionRow): InstitutionDto => ({
  id: row.id,
  type: row.type,
  cityId: row.city_id,
  districtId: row.district_id,
  name: row.name,
  fullName: row.full_name,
});

export async function listCities(): Promise<CityDto[]> {
  const rows = must(await supabaseAdmin.from("cities").select("id, name").order("name"));
  return rows;
}

export async function listDistricts(cityId?: string): Promise<DistrictDto[]> {
  let query = supabaseAdmin.from("districts").select("*").order("name");
  if (cityId) query = query.eq("city_id", cityId);
  return must(await query).map(toDistrict);
}

export async function listInstitutions(filters: {
  cityId?: string | undefined;
  districtId?: string | undefined;
  type?: InstitutionType | undefined;
}): Promise<InstitutionDto[]> {
  let query = supabaseAdmin.from("institutions").select("*");
  if (filters.cityId) query = query.eq("city_id", filters.cityId);
  if (filters.districtId) query = query.eq("district_id", filters.districtId);
  if (filters.type) query = query.eq("type", filters.type);
  const rows = must(await query.order("type").order("name"));
  // Школы по номеру: «Школа №2» раньше «Школа №10»
  return rows
    .map(toInstitution)
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, "ru", { numeric: true }));
}

// Проверка выбора места с понятными сообщениями (база всё равно не пропустит несовместимое — это FK)
export async function assertValidLocation(location: LocationInput): Promise<void> {
  const district = maybe(
    await supabaseAdmin.from("districts").select("*").eq("id", location.districtId).maybeSingle(),
  );
  if (!district) throw apiErrors.badRequest("Район не найден", "INVALID_LOCATION");
  if (district.city_id !== location.cityId) {
    throw apiErrors.badRequest("Этот район не относится к выбранному городу", "INVALID_LOCATION");
  }
  if (location.institutionId && location.institutionType) {
    const institution = maybe(
      await supabaseAdmin
        .from("institutions")
        .select("*")
        .eq("district_id", location.districtId)
        .eq("id", location.institutionId)
        .maybeSingle(),
    );
    if (!institution || institution.type !== location.institutionType) {
      throw apiErrors.badRequest(
        "Это учебное заведение не относится к выбранному району и типу",
        "INVALID_LOCATION",
      );
    }
  }
}

// Названия для профиля: «Бишкек», «Первомайский район», «КНУ»
export async function getLocationNames(location: {
  city_id: string | null;
  district_id: string | null;
  institution_id: string | null;
}): Promise<{ city: string | null; district: string | null; institution: string | null }> {
  const [city, district, institution] = await Promise.all([
    location.city_id
      ? supabaseAdmin.from("cities").select("name").eq("id", location.city_id).maybeSingle()
      : null,
    location.district_id
      ? supabaseAdmin.from("districts").select("name").eq("id", location.district_id).maybeSingle()
      : null,
    location.district_id && location.institution_id
      ? supabaseAdmin
          .from("institutions")
          .select("name")
          .eq("district_id", location.district_id)
          .eq("id", location.institution_id)
          .maybeSingle()
      : null,
  ]);
  return {
    city: city ? (maybe(city)?.name ?? null) : null,
    district: district ? (maybe(district)?.name ?? null) : null,
    institution: institution ? (maybe(institution)?.name ?? null) : null,
  };
}
