import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface FilterControlsProps {
  filters: {
    status?: string;
    fromDate?: string;
    toDate?: string;
    searchPhone?: string;
  };
  onFiltersChange: (filters: any) => void;
}

export default function FilterControls({ filters, onFiltersChange }: FilterControlsProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
  };

  const handleFilterChange = (key: string, value: string) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center space-x-2">
              <Label className="text-sm font-medium text-foreground">Status:</Label>
              <Select
                value={localFilters.status || "ALL"}
                onValueChange={(value) => handleFilterChange("status", value === "ALL" ? "" : value)}
              >
                <SelectTrigger className="w-32" data-testid="select-status-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PASS">Pass</SelectItem>
                  <SelectItem value="FAIL">Fail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Label className="text-sm font-medium text-foreground">Date:</Label>
              <Input
                type="date"
                value={localFilters.fromDate || ""}
                onChange={(e) => handleFilterChange("fromDate", e.target.value)}
                className="w-auto"
                data-testid="input-from-date"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={localFilters.toDate || ""}
                onChange={(e) => handleFilterChange("toDate", e.target.value)}
                className="w-auto"
                data-testid="input-to-date"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search by phone number..."
                value={localFilters.searchPhone || ""}
                onChange={(e) => handleFilterChange("searchPhone", e.target.value)}
                className="pl-10 pr-4 py-2 w-64"
                data-testid="input-search-phone"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"></i>
            </div>
            <Button onClick={handleApplyFilters} data-testid="button-apply-filters">
              Apply Filters
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
