import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAdvertisers } from "@/hooks/useAdvertisers";
import { useCreateInjectionPool } from "@/hooks/useInjectionPools";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  advertiser_id: z.string().min(1, "Select an advertiser"),
});

interface CreateInjectionPoolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInjectionPoolDialog({ open, onOpenChange }: CreateInjectionPoolDialogProps) {
  const navigate = useNavigate();
  const { data: advertisers } = useAdvertisers();
  const createPool = useCreateInjectionPool();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      advertiser_id: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const result = await createPool.mutateAsync({
      name: values.name,
      advertiser_id: values.advertiser_id,
    });
    onOpenChange(false);
    form.reset();
    navigate(`/injection-pools/${result.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Injection Pool</DialogTitle>
          <DialogDescription>
            Set up a new isolated injection campaign
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pool Name</FormLabel>
                  <FormControl>
                    <Input placeholder="UK Leads - Feb 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="advertiser_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Advertiser</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select advertiser" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {advertisers?.filter(a => a.is_active).map((adv) => (
                        <SelectItem key={adv.id} value={adv.id}>
                          {adv.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPool.isPending}>
                {createPool.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Pool
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
