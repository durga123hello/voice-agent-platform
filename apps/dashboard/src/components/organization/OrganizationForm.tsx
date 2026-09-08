"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Building, 
  Pencil,
  Mail, 
  UploadCloud, 
  CheckCircle2, 
  ArrowLeft,
  User as UserIcon,
  Globe,
  Briefcase
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
import { Organization, OrganizationStatus } from "../../types/organization";

const STORAGE_KEY = "vopx_organizations_data_v1";

export function OrganizationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams ? searchParams.get("edit") : null;
  const isEditMode = Boolean(editId);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    email: "",
    adminName: "",
    countryCode: "+974",
    phone: "",
    country: "Qatar",
    industry: "Voice Artificial Intelligence",
    status: "Active" as OrganizationStatus,
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pre-fill on Edit
  useEffect(() => {
    if (!editId) return;
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) {
        const orgList: Organization[] = JSON.parse(existing);
        const target = orgList.find((o) => o.id === editId);
        if (target) {
          let code = "+974";
          let num = target.phone || "";
          if (target.phone && target.phone.startsWith("+")) {
            const parts = target.phone.split(" ");
            code = parts[0];
            num = parts.slice(1).join(" ");
          }

          setFormData({
            name: target.name,
            code: target.code,
            email: target.email,
            adminName: target.adminName || "",
            countryCode: code,
            phone: num,
            country: target.country,
            industry: target.industry || "Voice Artificial Intelligence",
            status: target.status,
          });

          if (target.logoUrl) {
            setLogoPreview(target.logoUrl);
          }
        }
      }
    } catch (e) {
      console.error("Failed loading organization for edit", e);
    }
  }, [editId]);

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Organization name is required";
    if (!formData.code.trim()) newErrors.code = "Organization code is required";

    if (!formData.email.trim()) {
      newErrors.email = "Official email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    if (!formData.country) newErrors.country = "Country is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, logo: "Only image files (JPEG, PNG, WEBP) are accepted." }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, logo: "File size exceeds 2MB limit." }));
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.logo;
      return copy;
    });
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    const formattedDate = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    if (isEditMode && editId) {
      try {
        const existing = localStorage.getItem(STORAGE_KEY);
        const orgList: Organization[] = existing ? JSON.parse(existing) : [];
        const updatedList = orgList.map((o) => {
          if (o.id === editId) {
            return {
              ...o,
              name: formData.name.trim(),
              code: formData.code.trim().toUpperCase(),
              email: formData.email.trim(),
              adminName: formData.adminName.trim() || undefined,
              phone: `${formData.countryCode} ${formData.phone.trim()}`,
              country: formData.country,
              industry: formData.industry,
              status: formData.status,
              logoUrl: logoPreview || o.logoUrl,
            };
          }
          return o;
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      } catch (err) {
        console.error("Failed updating organization", err);
      }

      setToastMessage(`Organization ${formData.name} updated successfully! Redirecting...`);
      setTimeout(() => {
        router.push("/organization");
      }, 900);
      return;
    }

    // CREATE MODE
    const newOrg: Organization = {
      id: `org-${Date.now()}`,
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      email: formData.email.trim(),
      adminName: formData.adminName.trim() || undefined,
      phone: `${formData.countryCode} ${formData.phone.trim()}`,
      country: formData.country,
      industry: formData.industry,
      status: formData.status,
      createdAt: formattedDate,
      logoUrl: logoPreview || undefined,
    };

    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const orgList: Organization[] = existing ? JSON.parse(existing) : [];
      orgList.unshift(newOrg);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orgList));
    } catch (err) {
      console.error("Failed saving organization", err);
    }

    setToastMessage(`Organization ${newOrg.name} registered successfully! Redirecting...`);
    setTimeout(() => {
      router.push("/organization");
    }, 900);
  };

  const countries = [
    "Qatar", "United States", "United Kingdom", "Canada", "Germany", 
    "France", "Sweden", "Singapore", "Saudi Arabia", "United Arab Emirates", 
    "India", "Australia", "Japan", "Switzerland", "Netherlands"
  ];

  const industries = [
    "Voice Artificial Intelligence",
    "Healthcare & Telehealth",
    "Telecommunications & VoIP",
    "Fintech & Banking",
    "Supply Chain & Logistics",
    "E-Commerce & Retail",
    "Hospitality & Aviation",
    "Government & Public Sector"
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

      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border/60">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground">
          <Link href="/organization">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {isEditMode ? (
              <>
                <Pencil className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                Edit Organization
              </>
            ) : (
              <>
                <Building className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                Organization Sign-up & Registration
              </>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isEditMode 
              ? `Update corporate parameters, tenant code, and administrative credentials.`
              : `Register a new tenant organization to provision isolated voice agents, phone numbers, and workspace bounds.`}
          </p>
        </div>
      </div>

      {/* 3-Column Responsive Grid Form */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Organization Name */}
          <div className="space-y-1.5">
            <Label htmlFor="orgName" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Organization Name <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="orgName"
              placeholder="e.g. SwarmX AI Systems"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? "border-rose-500" : ""}
            />
            {errors.name && <p className="text-[11px] text-rose-500">{errors.name}</p>}
          </div>

          {/* 2. Organization Code */}
          <div className="space-y-1.5">
            <Label htmlFor="orgCode" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Organization Code <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Input
              id="orgCode"
              placeholder="e.g. ORG-SWMX"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className={`font-mono text-xs ${errors.code ? "border-rose-500" : ""}`}
            />
            {errors.code && <p className="text-[11px] text-rose-500">{errors.code}</p>}
          </div>

          {/* 3. Official Email */}
          <div className="space-y-1.5">
            <Label htmlFor="orgEmail" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Official Email <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="orgEmail"
                type="email"
                placeholder="contact@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`pl-9 ${errors.email ? "border-rose-500" : ""}`}
              />
            </div>
            {errors.email && <p className="text-[11px] text-rose-500">{errors.email}</p>}
          </div>

          {/* 4. Primary Administrator Name */}
          <div className="space-y-1.5">
            <Label htmlFor="adminName" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Primary Administrator
            </Label>
            <div className="relative">
              <UserIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="adminName"
                placeholder="e.g. Sarah Al-Mansoor"
                value={formData.adminName}
                onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                className="pl-9"
              />
            </div>
          </div>

          {/* 5. Phone Number with Country Code */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs font-semibold text-foreground flex items-center gap-1">
              Phone Number <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
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
                  <SelectItem value="+971">🇦🇪 +971</SelectItem>
                  <SelectItem value="+46">🇸🇪 +46</SelectItem>
                  <SelectItem value="+65">🇸🇬 +65</SelectItem>
                  <SelectItem value="+91">🇮🇳 +91</SelectItem>
                </SelectContent>
              </Select>
              <Input
                id="phone"
                type="tel"
                placeholder="4488 9900"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`flex-1 ${errors.phone ? "border-rose-500" : ""}`}
              />
            </div>
            {errors.phone && <p className="text-[11px] text-rose-500">{errors.phone}</p>}
          </div>

          {/* 6. Country */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Country of Registration <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.country}
              onValueChange={(val) => setFormData({ ...formData, country: val })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 7. Industry / Sector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Industry / Sector
            </Label>
            <Select
              value={formData.industry}
              onValueChange={(val) => setFormData({ ...formData, industry: val })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {industries.map((ind) => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 8. Initial Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Organization Status <span className="text-teal-700 dark:text-teal-400 font-bold">*</span>
            </Label>
            <Select
              value={formData.status}
              onValueChange={(val) => setFormData({ ...formData, status: val as OrganizationStatus })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">🟢 Active</SelectItem>
                <SelectItem value="Pending">🟡 Pending Approval</SelectItem>
                <SelectItem value="Inactive">⚪ Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logo Upload Section */}
        <div className="pt-4 border-t border-border/70 space-y-2">
          <Label className="text-xs font-semibold text-foreground">
            Organization Logo / Brand Mark
          </Label>
          <div className="relative border-2 border-dashed border-border hover:border-teal-700/60 dark:hover:border-teal-400/60 rounded-xl p-4 text-center transition-colors bg-muted/20 max-w-md">
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="logo-upload"
            />
            {logoPreview ? (
              <div className="flex items-center justify-center gap-3">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="h-16 w-16 object-cover rounded-xl border border-border"
                />
                <div className="text-left">
                  <p className="text-xs font-semibold text-foreground truncate max-w-[180px]">
                    {logoFile?.name || "Uploaded Logo"}
                  </p>
                  <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">Click to change logo</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-1 pointer-events-none">
                <UploadCloud className="h-8 w-8 text-muted-foreground/60" />
                <p className="text-xs font-medium text-foreground">Click to upload company logo</p>
                <p className="text-[11px] text-muted-foreground">PNG, JPG, or SVG (Max 2MB)</p>
              </div>
            )}
          </div>
          {errors.logo && <p className="text-[11px] text-rose-500">{errors.logo}</p>}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-border bg-background/95 px-6 py-3.5 backdrop-blur shadow-lg">
        <div className="text-xs text-muted-foreground hidden sm:block">
          {isEditMode ? (
            <span>Updating organization parameters. Changes sync across all workspace tenants immediately.</span>
          ) : (
            <span>Please verify all required corporate credentials marked with an asterisk (<span className="text-teal-700 dark:text-teal-400 font-bold">*</span>).</span>
          )}
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push("/organization")}
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
              ? (isEditMode ? "Saving Changes..." : "Registering...") 
              : (isEditMode ? "Save Changes" : "Register Organization")}
          </Button>
        </div>
      </div>
    </form>
  );
}
