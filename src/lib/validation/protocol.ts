import { z } from "zod";
import { protocolDraftSaveSchema } from "@/lib/domain/protocol-studio";

export const saveProtocolSchema = protocolDraftSaveSchema;

export const publishProtocolSchema = z.object({
  changeSummary: z.string().trim().max(500).optional().or(z.literal(""))
});

export const issueFromTemplateSchema = z.object({
  templateVersionId: z.string().uuid(),
  clientName: z.string().trim().min(1).max(120),
  mobile: z.string().trim().max(32).optional().or(z.literal("")),
  treatmentDate: z.iso.date()
});
