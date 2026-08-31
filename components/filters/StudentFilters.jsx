import React from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';

export const SearchFilter = ({ searchTerm, setSearchTerm, loading, placeholder = "Search..." }) => {
  return (
    <div className="flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        {loading ? (
          <div className="pl-10">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Input
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        )}
      </div>
    </div>
  );
};

export const SelectFilter = ({ 
  value, 
  onValueChange, 
  loading, 
  placeholder, 
  options = [], 
  allLabel = "All",
  className = "w-full lg:w-48" 
}) => {
  return (
    <div className={className}>
      {loading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">{allLabel}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export const MadrasaFilter = ({ value, onValueChange, loading, madarsas = [] }) => {
  const options = madarsas.map(madarsa => ({
    value: madarsa.id,
    label: `${madarsa.name} (${madarsa.madarsaId})`
  }));

  return (
    <SelectFilter
      value={value}
      onValueChange={onValueChange}
      loading={loading}
      placeholder="Filter by Madrasa"
      options={options}
      allLabel="All Madrasas"
    />
  );
};

export const MekhalaFilter = ({ value, onValueChange, loading, mekhalas = [] }) => {
  const options = mekhalas.map(mekhala => ({
    value: mekhala.id,
    label: mekhala.name
  }));

  return (
    <SelectFilter
      value={value}
      onValueChange={onValueChange}
      loading={loading}
      placeholder="Filter by Mekhala"
      options={options}
      allLabel="All Mekhalas"
    />
  );
};

export const GenderFilter = ({ value, onValueChange, loading }) => {
  const options = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <SelectFilter
      value={value}
      onValueChange={onValueChange}
      loading={loading}
      placeholder="Filter by Gender"
      options={options}
      allLabel="All Genders"
    />
  );
};

export const StatusFilter = ({ value, onValueChange, loading }) => {
  const options = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' }
  ];

  return (
    <SelectFilter
      value={value}
      onValueChange={onValueChange}
      loading={loading}
      placeholder="Filter by Status"
      options={options}
      allLabel="All Status"
    />
  );
};

export const FiltersContainer = ({ children, className = "" }) => {
  return (
    <div className={`flex flex-col space-y-4 lg:flex-row lg:space-y-0 lg:gap-4 ${className}`}>
      {children}
    </div>
  );
};