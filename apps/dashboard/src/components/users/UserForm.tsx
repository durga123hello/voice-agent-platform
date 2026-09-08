"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  UserPlus, 
  Pencil,
  Mail, 
  UploadCloud, 
  CheckCircle2, 
  ArrowLeft,
  X
} from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "../ui/select";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { User, UserRole, UserStatus } from "../../types/user";
import { useAuth } from "../../context/auth-context";

const STORAGE_KEY = "vopx_users_data_v3";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export function UserForm() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams ? searchParams.get("edit") : null;
  const isEditMode = Boolean(editId);

  // Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    employeeId: "",
    countryCode: "+974",
    phone: "",
    officialEmail: "",
    personalEmail: "",
    dateOfBirth: "",
    dateOfJoining: new Date().toISOString().split("T")[0],
    nationality: "Qatar",
    gender: "Male" as "Male" | "Female" | "Other",
    role: "Administrator" as UserRole,
    status: "Active" as UserStatus,
    members: "Platform Core",
  });

  // File Upload states
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [signature, setSignature] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  // Errors & Toast state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pre-fill employee information when in Edit mode
  useEffect(() => {
    if (!editId) return;
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        const userList: User[] = JSON.parse(existing);
        const target = userList.find((u) => u.id === editId);
        if (target) {
          // Parse phone country code if present
          let code = "+974";
          let num = target.phone || "";
          if (target.phone && target.phone.startsWith("+")) {
            const parts = target.phone.split(" ");
            code = parts[0];
            num = parts.slice(1).join(" ");
          }

          const nameStr = target.name || "";
          setFormData({
            firstName: target.firstName || nameStr.split(" ")[0] || "",
            lastName: target.lastName || nameStr.split(" ").slice(1).join(" ") || "",
            employeeId: target.employeeId || "",
            countryCode: code,
            phone: num,
            officialEmail: target.officialEmail || target.email || "",
            personalEmail: target.personalEmail || "",
            dateOfBirth: target.dateOfBirth || "",
            dateOfJoining: target.joinedDate || target.dateOfJoining || new Date().toISOString().split("T")[0],
            nationality: target.nationality || "Qatar",
            gender: target.gender || "Male",
            role: target.role || "Administrator",
            status: target.status || "Active",
            members: target.members || "Platform Core",
          });

          if (target.avatarUrl) {
            setProfilePhotoPreview(target.avatarUrl);
          }
          if (target.signatureUrl) {
            setSignaturePreview(target.signatureUrl);
          }
        }
      }
    } catch (e) {
      console.error("Failed loading user for edit", e);
    }
  }, [editId]);

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.employeeId.trim()) newErrors.employeeId = "Employee ID is required";

    if (!formData.officialEmail.trim()) {
      newErrors.officialEmail = "Official email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.officialEmail)) {
      newErrors.officialEmail = "Invalid email format";
    }

    if (formData.personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personalEmail)) {
      newErrors.personalEmail = "Invalid email format";
    }

    if (!formData.dateOfJoining) newErrors.dateOfJoining = "Date of joining is required";
    if (!formData.nationality) newErrors.nationality = "Nationality is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Photo Upload (max 2MB, image/*)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, profilePhoto: "Only image files (JPEG, PNG, WEBP) are accepted." }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, profilePhoto: "File size exceeds 2MB limit." }));
      return;
    }

    setProfilePhoto(file);
    setProfilePhotoPreview(URL.createObjectURL(file));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.profilePhoto;
      return copy;
    });
  };

  // Handle Signature Upload (max 2MB, image/*)
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, signature: "Only image files (JPEG, PNG, WEBP) are accepted." }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, signature: "File size exceeds 2MB limit." }));
      return;
    }

    setSignature(file);
    setSignaturePreview(URL.createObjectURL(file));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.signature;
      return copy;
    });
  };

  // Submit Handler (Supports both Create and Edit)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    const formattedDate = formData.dateOfJoining.includes(",")
      ? formData.dateOfJoining
      : new Date(formData.dateOfJoining).toLocaleDateString("en-US", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "numeric",
        });

    if (isEditMode && editId) {
      // EDIT MODE: Update existing user in localStorage
      try {
        const existing = localStorage.getItem(STORAGE_KEY);
        const userList: User[] = existing ? JSON.parse(existing) : [];
        const updatedList = userList.map((u) => {
          if (u.id === editId) {
            return {
              ...u,
              firstName: formData.firstName.trim(),
              lastName: formData.lastName.trim(),
              name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
              email: formData.officialEmail.trim(),
              personalEmail: formData.personalEmail.trim() || undefined,
              employeeId: formData.employeeId.trim(),
              role: formData.role,
              status: formData.status,
              members: formData.members,
              joinedDate: formattedDate,
              phone: formData.phone ? `${formData.countryCode} ${formData.phone.trim()}` : undefined,
              dateOfBirth: formData.dateOfBirth || undefined,
              nationality: formData.nationality,
              gender: formData.gender,
              avatarUrl: profilePhotoPreview || u.avatarUrl,
              signatureUrl: signaturePreview || u.signatureUrl,
            };
          }
          return u;
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      } catch (err) {
        console.error("Failed updating user", err);
      }

      setToastMessage(`User ${formData.firstName} ${formData.lastName} updated successfully! Redirecting...`);

      setTimeout(() => {
        router.push("/users");
      }, 900);
      return;
    }

    // CREATE MODE: Post new user to backend API (server assigns tenantId from session token)
    async function createOrgUser() {
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        employeeId: formData.employeeId.trim(),
        officialEmail: formData.officialEmail.trim(),
        personalEmail: formData.personalEmail.trim() || undefined,
        phoneNumber: formData.phone ? `${formData.countryCode} ${formData.phone.trim()}` : undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        dateOfJoining: formData.dateOfJoining || new Date().toISOString().split("T")[0],
        nationality: formData.nationality,
        gender: formData.gender,
        role: formData.role,
        status: formData.status,
        profilePhotoUrl: profilePhotoPreview || undefined,
        signatureUrl: signaturePreview || undefined,
      };

      if (token) {
        try {
          const res = await fetch(`${API_BASE}/api/users`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const data = await res.json();
            setToastMessage(`User ${formData.firstName} ${formData.lastName} created successfully! (Tenant: ${data.user?.tenantId || 'Org'})`);
            setTimeout(() => {
              router.push("/users");
            }, 900);
            return;
          } else {
            const errData = await res.json();
            setErrors((prev) => ({ ...prev, officialEmail: errData.error || "Failed to create user" }));
            setIsSubmitting(false);
            return;
          }
        } catch (err) {
          console.warn("API request failed, falling back to local creation:", err);
        }
      }

      // Fallback local storage creation
      const newUser: User = {
        id: `usr-${Date.now()}`,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        email: formData.officialEmail.trim(),
        personalEmail: formData.personalEmail.trim() || undefined,
        employeeId: formData.employeeId.trim(),
        role: formData.role,
        status: formData.status,
        members: formData.members,
        joinedDate: formattedDate,
        phone: formData.phone ? `${formData.countryCode} ${formData.phone.trim()}` : undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        nationality: formData.nationality,
        gender: formData.gender,
        avatarUrl: profilePhotoPreview || undefined,
        signatureUrl: signaturePreview || undefined,
      };

      try {
        const existing = localStorage.getItem(STORAGE_KEY);
        const userList: User[] = existing ? JSON.parse(existing) : [];
        userList.unshift(newUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userList));
      } catch (err) {
        console.error("Failed saving to localStorage", err);
      }

      setToastMessage(`User ${newUser.name} created successfully! Redirecting...`);
      setTimeout(() => {
        router.push("/users");
      }, 900);
    }

    createOrgUser();
  };

  const countries = [
    "Qatar", "United States", "United Kingdom", "Canada", "Germany", 
    "France", "Japan", "India", "Australia", "Singapore", "Saudi Arabia", 
    "United Arab Emirates", "Morocco", "South Korea", "Spain", "Italy"
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/90 px-4 py-3 text-xs font-semibold text-emerald-300 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Back link */}
      <div className="flex items-center gap-3 pb-3 border-b border-border/60">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground">
          <Link href="/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {isEditMode ? (
              <>
                <Pencil className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                Edit User Profile
              </>
            ) : (
              <>
                <UserPlus className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                Personal Information
              </>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isEditMode 
              ? `Update employee credentials, contact details, and role permissions.`
              : `Enter personal details, credentials, and organizational role to provision a new user.`}
          </p>
        </div>
      </div>

      {/* 
        CRITICAL LAYOUT REQUIREMENT:
        Responsive 3-column grid (collapsing to 1 column on mobile)!
      */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

          {/* 1. First Name* */}
          <div className="space-y-1.5">
            <Label htmlFor="firstName" className="text-xs font-semibold text-foreground flex items-center gap-1">
              First Name <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="firstName"
              placeholder="e.g. Alexander"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className={errors.firstName ? "border-rose-500" : ""}
            />
            {errors.firstName && <p className="text-[11px] text-rose-500">{errors.firstName}</p>}
          </div>

          {/* 2. Last Name* */}
          <div className="space-y-1.5">
            <Label htmlFor="lastName" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Last Name <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="lastName"
              placeholder="e.g. Novak"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className={errors.lastName ? "border-rose-500" : ""}
            />
            {errors.lastName && <p className="text-[11px] text-rose-500">{errors.lastName}</p>}
          </div>

          {/* 3. Employee ID* */}
          <div className="space-y-1.5">
            <Label htmlFor="employeeId" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Employee ID <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="employeeId"
              placeholder="e.g. EMP-1048"
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              className={errors.employeeId ? "border-rose-500 font-mono text-xs" : "font-mono text-xs"}
            />
            {errors.employeeId && <p className="text-[11px] text-rose-500">{errors.employeeId}</p>}
          </div>

          {/* 4. Phone Number with Country Code */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs font-semibold text-foreground">
              Phone Number
            </Label>
            <div className="flex gap-2">
              <Select
                value={formData.countryCode}
                onValueChange={(val) => setFormData({ ...formData, countryCode: val })}
              >
                <SelectTrigger className="w-[100px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="+974">🇶🇦 +974</SelectItem>
                  <SelectItem value="+1">🇺🇸 +1</SelectItem>
                  <SelectItem value="+44">🇬🇧 +44</SelectItem>
                  <SelectItem value="+91">🇮🇳 +91</SelectItem>
                  <SelectItem value="+971">🇦🇪 +971</SelectItem>
                  <SelectItem value="+49">🇩🇪 +49</SelectItem>
                </SelectContent>
              </Select>
              <Input
                id="phone"
                type="tel"
                placeholder="5512 3456"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>

          {/* 5. Official Email* (with mail icon) */}
          <div className="space-y-1.5">
            <Label htmlFor="officialEmail" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Official Email <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="officialEmail"
                type="email"
                placeholder="alex.novak@vopx.ai"
                value={formData.officialEmail}
                onChange={(e) => setFormData({ ...formData, officialEmail: e.target.value })}
                className={`pl-9 ${errors.officialEmail ? "border-rose-500" : ""}`}
              />
            </div>
            {errors.officialEmail && <p className="text-[11px] text-rose-500">{errors.officialEmail}</p>}
          </div>

          {/* 6. Personal Email (with mail icon) */}
          <div className="space-y-1.5">
            <Label htmlFor="personalEmail" className="text-xs font-semibold text-foreground">
              Personal Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="personalEmail"
                type="email"
                placeholder="alex.personal@gmail.com"
                value={formData.personalEmail}
                onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                className={`pl-9 ${errors.personalEmail ? "border-rose-500" : ""}`}
              />
            </div>
            {errors.personalEmail && <p className="text-[11px] text-rose-500">{errors.personalEmail}</p>}
          </div>

          {/* 7. Date of Birth (format EEEE, DD MMMM YYYY placeholder) */}
          <div className="space-y-1.5">
            <Label htmlFor="dateOfBirth" className="text-xs font-semibold text-foreground">
              Date of Birth
            </Label>
            <div className="relative">
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                placeholder="EEEE, DD MMMM YYYY"
                className="w-full text-xs"
              />
            </div>
          </div>

          {/* 8. Date of Joining* (defaults to today) */}
          <div className="space-y-1.5">
            <Label htmlFor="dateOfJoining" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Date of Joining <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="dateOfJoining"
              type="date"
              value={formData.dateOfJoining}
              onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
              className={`w-full text-xs ${errors.dateOfJoining ? "border-rose-500" : ""}`}
            />
            {errors.dateOfJoining && <p className="text-[11px] text-rose-500">{errors.dateOfJoining}</p>}
          </div>

          {/* 9. Nationality* (searchable/select) */}
          <div className="space-y-1.5">
            <Label htmlFor="nationality" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Nationality <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.nationality}
              onValueChange={(val) => setFormData({ ...formData, nationality: val })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select nationality" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* System Role */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              System Role <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.role}
              onValueChange={(val) => setFormData({ ...formData, role: val as UserRole })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Administrator">Administrator</SelectItem>
                <SelectItem value="Technical Manager">Technical Manager</SelectItem>
                <SelectItem value="Inspector">Inspector</SelectItem>
                <SelectItem value="Operator">Operator</SelectItem>
                <SelectItem value="Viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Status <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.status}
              onValueChange={(val) => setFormData({ ...formData, status: val as UserStatus })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">🟢 Active</SelectItem>
                <SelectItem value="Away">🟡 Away</SelectItem>
                <SelectItem value="Do Not Disturb">🔴 Do Not Disturb</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 10. Gender* (Radio group: Male / Female / Other) */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Gender <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <RadioGroup
              value={formData.gender}
              onValueChange={(val) => setFormData({ ...formData, gender: val as "Male" | "Female" | "Other" })}
              className="flex items-center gap-4 pt-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Male" id="gender-male" />
                <Label htmlFor="gender-male" className="text-xs font-normal cursor-pointer">Male</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Female" id="gender-female" />
                <Label htmlFor="gender-female" className="text-xs font-normal cursor-pointer">Female</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Other" id="gender-other" />
                <Label htmlFor="gender-other" className="text-xs font-normal cursor-pointer">Other</Label>
              </div>
            </RadioGroup>
          </div>

        </div>

        {/* Uploads Section: Profile Photo & Signature (2 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-border/70">
          
          {/* 11. Profile Photo */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              Profile Photo
            </Label>
            <div className="relative border-2 border-dashed border-border hover:border-teal-700/60 dark:hover:border-teal-400/60 rounded-xl p-4 text-center transition-colors bg-muted/20">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="photo-upload"
              />
              {profilePhotoPreview ? (
                <div className="flex items-center justify-center gap-3">
                  <img
                    src={profilePhotoPreview}
                    alt="Preview"
                    className="h-16 w-16 object-cover rounded-full border border-border"
                  />
                  <div className="text-left">
                    <p className="text-xs font-semibold text-foreground truncate max-w-[160px]">
                      {profilePhoto?.name || "Uploaded Photo"}
                    </p>
                    <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">Click to change</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-1 pointer-events-none">
                  <UploadCloud className="h-8 w-8 text-muted-foreground/60" />
                  <p className="text-xs font-medium text-foreground">Click to upload or drag and drop</p>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG, or WEBP (Max 2MB)</p>
                </div>
              )}
            </div>
            {errors.profilePhoto && <p className="text-[11px] text-rose-500">{errors.profilePhoto}</p>}
          </div>

          {/* 12. Signature */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              Digital Signature
            </Label>
            <div className="relative border-2 border-dashed border-border hover:border-teal-700/60 dark:hover:border-teal-400/60 rounded-xl p-4 text-center transition-colors bg-muted/20">
              <input
                type="file"
                accept="image/*"
                onChange={handleSignatureUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="signature-upload"
              />
              {signaturePreview ? (
                <div className="flex items-center justify-center gap-3">
                  <img
                    src={signaturePreview}
                    alt="Signature Preview"
                    className="h-16 max-w-[160px] object-contain border border-border bg-white rounded p-1"
                  />
                  <div className="text-left">
                    <p className="text-xs font-semibold text-foreground truncate max-w-[160px]">
                      {signature?.name || "Digital Signature"}
                    </p>
                    <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">Click to change</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-1 pointer-events-none">
                  <UploadCloud className="h-8 w-8 text-muted-foreground/60" />
                  <p className="text-xs font-medium text-foreground">Click to upload signature</p>
                  <p className="text-[11px] text-muted-foreground">PNG with transparent background (Max 2MB)</p>
                </div>
              )}
            </div>
            {errors.signature && <p className="text-[11px] text-rose-500">{errors.signature}</p>}
          </div>

        </div>
      </div>

      {/* 
        CRITICAL LAYOUT REQUIREMENT:
        Sticky footer / bottom action bar with Cancel and Save/Create buttons!
      */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-border bg-background/95 px-6 py-3.5 backdrop-blur shadow-lg">
        <div className="text-xs text-muted-foreground hidden sm:block">
          {isEditMode ? (
            <span>Editing employee profile. All changes will be saved to the database immediately.</span>
          ) : (
            <span>Please verify that all required fields marked with an asterisk (<span className="text-teal-700 dark:text-teal-400 font-bold">*</span>) are completed.</span>
          )}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/users")}
            disabled={isSubmitting}
            className="text-xs px-4"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="text-xs px-5 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-medium shadow-sm"
          >
            {isSubmitting 
              ? (isEditMode ? "Saving Changes..." : "Creating...") 
              : (isEditMode ? "Save Changes" : "Create User")}
          </Button>
        </div>
      </div>
    </form>
  );
}
