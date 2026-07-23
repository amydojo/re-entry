import { z } from "zod";

export const issuePassSchema = z.object({
  clientName: z.string().trim().min(1).max(120),
  mobile: z.string().trim().max(32).optional().or(z.literal("")),
  treatmentDate: z.iso.date(),
  treatmentName: z.literal("Microneedling"),
  items: z.array(z.object({
    key: z.enum(["makeup", "exfoliating-acids", "retinoid", "intense-exercise"]),
    returnDay: z.number().int().min(0).max(90)
  })).length(4)
});

export const updateEventSchema = z.object({
  returnAt: z.iso.datetime({ offset: true }),
  reason: z.string().trim().min(3).max(300)
});

export const revokePassSchema = z.object({
  note: z.string().trim().min(3).max(300)
});

export const verifyPassSchema = z.object({
  publicId: z.string().trim().min(5).max(32),
  token: z.string().trim().min(12).max(256)
});
