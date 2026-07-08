import { z } from "zod";

const moneyVndSchema = z.coerce.number().int().nonnegative();
const quantitySchema = z.coerce.number().finite().positive();
const percentSchema = z.coerce.number().finite().min(0).max(100);

export const upsertProductRecipeSchema = z.object({
  targetType: z.enum(["MENU_ITEM", "MENU_VARIANT"]),
  targetId: z.string().uuid(),
  packagingCostVnd: moneyVndSchema.default(0),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : null)),
  ingredients: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid(),
        quantity: quantitySchema,
        unit: z.string().trim().min(1).max(24),
        wastePercent: percentSchema.default(0)
      })
    )
    .max(50)
    .default([])
});

export const updateProductMarginRuleSchema = z.object({
  thresholdPercent: z.coerce.number().finite().min(0).max(95)
});

export type UpsertProductRecipeInput = z.infer<typeof upsertProductRecipeSchema>;
export type UpdateProductMarginRuleInput = z.infer<typeof updateProductMarginRuleSchema>;
