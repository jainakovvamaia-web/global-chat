"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import LocationEducationFields from "@/components/profile/LocationEducationFields/LocationEducationFields";
import Button from "@/components/ui/Button/Button";
import TextField from "@/components/ui/TextField/TextField";
import { useAuth } from "@/hooks/api/useAuth";
import { useProfile, useUpdateProfile } from "@/hooks/api/useProfile";
import { getErrorMessage } from "@/lib/api";
import { EMPTY_LOCATION, validateLocation, type LocationErrors } from "@/lib/locations";
import type { LocationSelection, Profile } from "@/types";
import { AuthHeader, FormError } from "../AuthParts/AuthParts";
import styles from "../AuthParts/AuthParts.module.css";

// Заполнение профиля после входа через Google: Google не знает город, район и учебное заведение,
// а без них нельзя определить, какие чаты доступны пользователю.
export default function CompleteProfileForm() {
  const router = useRouter();
  const { isReady, isAuthenticated } = useAuth();
  const { data: profile } = useProfile();

  useEffect(() => {
    if (isReady && !isAuthenticated) router.replace("/login");
    else if (profile?.isProfileComplete) router.replace("/communities");
  }, [isReady, isAuthenticated, profile, router]);

  if (!profile || profile.isProfileComplete) return <AuthHeader title="Загрузка…" />;
  // key: форма заполняется данными профиля один раз, при его загрузке
  return <ProfileForm key={profile.id} profile={profile} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const updateProfile = useUpdateProfile();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [location, setLocation] = useState<LocationSelection>(EMPTY_LOCATION);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const locationErrors: LocationErrors = isSubmitted ? validateLocation(location) : {};
  const nameError = isSubmitted && (!firstName.trim() || !lastName.trim()) ? "Заполните имя и фамилию" : undefined;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitted(true);
    if (Object.keys(validateLocation(location)).length > 0 || !firstName.trim() || !lastName.trim()) return;
    updateProfile.mutate(
      { firstName: firstName.trim(), lastName: lastName.trim(), location },
      { onSuccess: () => router.replace("/communities") },
    );
  };

  return (
    <>
      <AuthHeader title="Почти готово" subtitle="Укажи, где ты живёшь и учишься — по этим данным откроются твои чаты" />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.row}>
          <TextField label="Имя" value={firstName} onChange={(event) => setFirstName(event.target.value)} error={nameError} />
          <TextField label="Фамилия" value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </div>
        <LocationEducationFields value={location} onChange={setLocation} errors={locationErrors} />
        {updateProfile.isError && <FormError>{getErrorMessage(updateProfile.error)}</FormError>}
        <Button type="submit" fullWidth disabled={updateProfile.isPending}>
          {updateProfile.isPending ? "Сохраняем…" : "Перейти к моим чатам"}
        </Button>
      </form>
    </>
  );
}
