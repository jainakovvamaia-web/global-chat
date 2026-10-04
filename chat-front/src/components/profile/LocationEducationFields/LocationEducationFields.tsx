import { SelectField } from "@/components/ui/TextField/TextField";
import { useCities, useDistricts, useInstitutions } from "@/hooks/api/useEducation";
import {
  changeLocation,
  getInstitutionLabel,
  INSTITUTION_TYPE_LABELS,
  type LocationErrors,
} from "@/lib/locations";
import type { InstitutionType, LocationSelection } from "@/types";
import styles from "./LocationEducationFields.module.css";

interface LocationEducationFieldsProps {
  value: LocationSelection;
  onChange: (next: LocationSelection) => void;
  errors?: LocationErrors;
}

const INSTITUTION_TYPE_OPTIONS = (Object.keys(INSTITUTION_TYPE_LABELS) as InstitutionType[]).map((type) => ({
  value: type,
  label: INSTITUTION_TYPE_LABELS[type],
}));

// Зависимые списки «город → район → тип → учебное заведение (этого района)».
// Используется и в регистрации, и в профиле. Списки загружаются с сервера.
export default function LocationEducationFields({ value, onChange, errors = {} }: LocationEducationFieldsProps) {
  const set = <K extends keyof LocationSelection>(field: K, fieldValue: LocationSelection[K]) =>
    onChange(changeLocation(value, field, fieldValue));

  const cities = useCities();
  const districts = useDistricts(value.cityId);
  const institutions = useInstitutions(value.districtId, value.institutionType);
  const institutionList = institutions.data ?? [];

  const institutionPlaceholder = institutions.isLoading
    ? "Загрузка…"
    : getInstitutionPlaceholder(value, institutionList.length);

  return (
    <div className={styles.fields}>
      <div className={styles.row}>
        <SelectField
          label="Город проживания"
          placeholder={cities.isLoading ? "Загрузка…" : "Выберите город"}
          options={(cities.data ?? []).map((city) => ({ value: city.id, label: city.name }))}
          value={value.cityId}
          onChange={(event) => set("cityId", event.target.value)}
          error={errors.cityId ?? (cities.isError ? "Не удалось загрузить список городов" : undefined)}
        />
        <SelectField
          label="Район проживания"
          placeholder={value.cityId ? (districts.isLoading ? "Загрузка…" : "Выберите район") : "Сначала выберите город"}
          options={(districts.data ?? []).map((district) => ({ value: district.id, label: district.name }))}
          value={value.districtId}
          onChange={(event) => set("districtId", event.target.value)}
          disabled={!value.cityId}
          error={errors.districtId}
        />
      </div>

      <SelectField
        label="Тип учебного заведения"
        placeholder="Не учусь / не указывать"
        options={INSTITUTION_TYPE_OPTIONS}
        value={value.institutionType}
        onChange={(event) => set("institutionType", event.target.value as InstitutionType | "")}
      />

      <SelectField
        label="Учебное заведение"
        placeholder={institutionPlaceholder}
        options={institutionList.map((item) => ({ value: item.id, label: getInstitutionLabel(item) }))}
        value={value.institutionId}
        onChange={(event) => set("institutionId", event.target.value)}
        disabled={institutionList.length === 0}
        error={errors.institutionId}
        hint={value.districtId ? "Учебные заведения выбранного района" : undefined}
      />
    </div>
  );
}

// Подсказка в пустом списке учебных заведений: чего не хватает для выбора
function getInstitutionPlaceholder(value: LocationSelection, optionsCount: number): string {
  if (!value.cityId) return "Сначала выберите город";
  if (!value.districtId) return "Сначала выберите район";
  if (!value.institutionType) return "Сначала выберите тип";
  if (optionsCount === 0) return "Нет доступных вариантов";
  return "Выберите учебное заведение";
}
