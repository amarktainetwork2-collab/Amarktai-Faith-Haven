import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";

type PropertyType = "house" | "apartment" | "townhouse" | "estate" | "commercial" | "land";

export type EditableProperty = {
  id: number;
  title: string;
  addressLine: string;
  suburb: string | null;
  city: string | null;
  province: string | null;
  priceZar: string | null;
  bedrooms: number;
  bathrooms: string;
  parking: number;
  floorAreaSqm: number | null;
  propertyType: PropertyType;
  description: string | null;
  features: string[] | null;
};

export function PropertyEditor({
  property,
  organisationId,
  onOpenChange,
}: {
  property: EditableProperty | null;
  organisationId?: number;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const update = trpc.property.update.useMutation({
    onSuccess: () => {
      utils.platform.snapshot.invalidate();
      onOpenChange(false);
    },
  });
  const [title, setTitle] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("0");
  const [bathrooms, setBathrooms] = useState("0");
  const [parking, setParking] = useState("0");
  const [floorArea, setFloorArea] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("house");
  const [description, setDescription] = useState("");
  const [featuresText, setFeaturesText] = useState("");

  useEffect(() => {
    if (!property) return;
    setTitle(property.title);
    setAddressLine(property.addressLine);
    setSuburb(property.suburb ?? "");
    setCity(property.city ?? "");
    setProvince(property.province ?? "");
    setPrice(property.priceZar ?? "");
    setBedrooms(String(property.bedrooms));
    setBathrooms(String(property.bathrooms));
    setParking(String(property.parking));
    setFloorArea(property.floorAreaSqm ? String(property.floorAreaSqm) : "");
    setPropertyType(property.propertyType);
    setDescription(property.description ?? "");
    setFeaturesText((property.features ?? []).join(", "));
  }, [property]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!property) return;
    update.mutate({
      propertyId: property.id,
      organisationId,
      title,
      addressLine,
      suburb: suburb.trim() || undefined,
      city: city.trim() || undefined,
      province: province.trim() || undefined,
      priceZar: price.trim() ? Number(price) : undefined,
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      parking: Number(parking),
      floorAreaSqm: floorArea.trim() ? Number(floorArea) : undefined,
      propertyType,
      description: description.trim() || undefined,
      features: featuresText.split(/[\n,]/).map(feature => feature.trim()).filter(Boolean).slice(0, 40),
    });
  };

  return (
    <Dialog open={Boolean(property)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border-[#e7e1d8] bg-[#fcfcfa]">
        <DialogHeader>
          <p className="eyebrow">Listing details</p>
          <DialogTitle className="font-editorial text-2xl text-[#193552]">Refine the property record.</DialogTitle>
          <DialogDescription>Keep the core listing facts accurate before sharing, exporting, or generating a buyer report.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-[#193552] sm:col-span-2">Listing title<Input required value={title} onChange={event => setTitle(event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#193552] sm:col-span-2">Address<Input required value={addressLine} onChange={event => setAddressLine(event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#193552]">Suburb<Input value={suburb} onChange={event => setSuburb(event.target.value)} placeholder="Optional" /></label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#193552]">City<Input value={city} onChange={event => setCity(event.target.value)} placeholder="Optional" /></label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#193552]">Province<Input value={province} onChange={event => setProvince(event.target.value)} placeholder="Optional" /></label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#193552]">Property type<select value={propertyType} onChange={event => setPropertyType(event.target.value as PropertyType)} className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"><option value="house">House</option><option value="apartment">Apartment</option><option value="townhouse">Townhouse</option><option value="estate">Estate</option><option value="commercial">Commercial</option><option value="land">Land</option></select></label>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <label className="grid gap-1.5 text-sm font-semibold text-[#193552] sm:col-span-2">Asking price<Input type="number" min="0" value={price} onChange={event => setPrice(event.target.value)} placeholder="ZAR" /></label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#193552]">Beds<Input type="number" min="0" value={bedrooms} onChange={event => setBedrooms(event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#193552]">Baths<Input type="number" min="0" step="0.5" value={bathrooms} onChange={event => setBathrooms(event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#193552]">Parking<Input type="number" min="0" value={parking} onChange={event => setParking(event.target.value)} /></label>
          </div>
          <label className="grid gap-1.5 text-sm font-semibold text-[#193552]">Floor area (m²)<Input type="number" min="1" value={floorArea} onChange={event => setFloorArea(event.target.value)} placeholder="Optional" /></label>
          <label className="grid gap-1.5 text-sm font-semibold text-[#193552]">Property features<textarea value={featuresText} onChange={event => setFeaturesText(event.target.value)} maxLength={3200} className="min-h-20 rounded-md border border-input bg-transparent p-3 text-sm" placeholder="Pool, borehole, solar backup, fibre (separate with commas or new lines)" /><span className="text-xs font-normal text-slate-500">Use concise factual features only. Up to 40 features are saved.</span></label>
          <label className="grid gap-1.5 text-sm font-semibold text-[#193552]">Description<textarea value={description} onChange={event => setDescription(event.target.value)} className="min-h-28 rounded-md border border-input bg-transparent p-3 text-sm" placeholder="Add a concise, factual listing description." /></label>
          {update.error && <p className="text-sm text-red-700">{update.error.message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={update.isPending} className="bg-[#193552] hover:bg-[#264b6c]">{update.isPending ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
