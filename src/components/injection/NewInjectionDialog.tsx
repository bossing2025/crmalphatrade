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
import { useLeadPools } from "@/hooks/useLeadPools";
import { useCreateInjection } from "@/hooks/useInjections";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  pool_id: z.string().min(1, "Select a lead pool"),
});

interface NewInjectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewInjectionDialog({ open, onOpenChange }: NewInjectionDialogProps) {
  const navigate = useNavigate();
  const { data: pools } = useLeadPools();
  const createInjection = useCreateInjection();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      pool_id: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const result = await createInjection.mutateAsync({
      name: values.name,
      pool_id: values.pool_id,
    });
    onOpenChange(false);
    form.reset();
    navigate(`/injections/${result.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Injection</DialogTitle>
          <DialogDescription>
            Set up a new injection campaign from a lead pool
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Injection Name</FormLabel>
                  <FormControl>
                    <Input placeholder="UK Campaign - Feb 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pool_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Lead Pool</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select lead pool" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pools?.map((pool) => (
                        <SelectItem key={pool.id} value={pool.id}>
                          {pool.name} ({pool.lead_count || 0} leads)
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
              <Button type="submit" disabled={createInjection.isPending}>
                {createInjection.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Injection
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}