import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Employee } from "@/pages/Index";
import type { Criteria } from "@/types/database";

interface EditEmployeeDialogProps {
  employee: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedEmployee: Employee) => void;
}

export const EditEmployeeDialog = ({ employee, isOpen, onClose, onUpdate }: EditEmployeeDialogProps) => {
  const [formData, setFormData] = useState<{ [key: string]: number }>({});
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Fungsi untuk mengkonversi nama kriteria menjadi field name yang konsisten
  const createFieldName = (criteriaName: string): string => {
    return criteriaName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Hapus karakter khusus
      .replace(/\s+/g, '_') // Ganti spasi dengan underscore
      .replace(/^_+|_+$/g, '') // Hapus underscore di awal/akhir
      .replace(/_+/g, '_'); // Ganti multiple underscore dengan single
  };

  // Mapping dinamis dari nama kriteria ke field Employee interface
  const createEmployeeFieldMapping = (criteriaName: string): string => {
    const fieldName = createFieldName(criteriaName);
    
    // Mapping khusus untuk kriteria yang sudah ada di Employee interface
    const specialMappings: { [key: string]: string } = {
      'kualitas_kerja': 'kualitasKerja',
      'tanggung_jawab': 'tanggungJawab',
      'kuantitas_kerja': 'kuantitasKerja',
      'pemahaman_tugas': 'pemahamanTugas',
      'inisiatif': 'inisiatif',
      'kerjasama': 'kerjasama',
      'jumlah_hari_alpa': 'hariAlpa',
      'jumlah_keterlambatan': 'keterlambatan',
      'jumlah_hari_izin': 'hariIzin',
      'jumlah_hari_sakit': 'hariSakit',
      'pulang_cepat': 'pulangCepat',
      'prestasi': 'prestasi',
      'surat_peringatan': 'suratPeringatan'
    };

    return specialMappings[fieldName] || fieldName;
  };

  // Fetch criteria from database
  const fetchCriteria = async () => {
    try {
      const { data: criteriaData, error } = await supabase
        .from('criteria')
        .select('*')
        .order('category', { ascending: true });
      
      if (error) {
        console.error('Error fetching criteria:', error);
      } else {
        setCriteria(criteriaData || []);
        console.log('EditEmployeeDialog: Criteria loaded:', criteriaData?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching criteria:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCriteria();
    }
  }, [isOpen]);

  useEffect(() => {
    if (employee && criteria.length > 0) {
      // Initialize form data dengan nilai dari employee
      const newFormData: { [key: string]: number } = {};
      
      criteria.forEach(criterion => {
        const formFieldName = createFieldName(criterion.name);
        const employeeFieldName = createEmployeeFieldMapping(criterion.name);
        const value = (employee as any)[employeeFieldName] || 0;
        newFormData[formFieldName] = value;
      });
      
      setFormData(newFormData);
      console.log('EditEmployeeDialog: Form data initialized:', newFormData);
    }
  }, [employee, criteria]);

  const handleInputChange = (field: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    setLoading(true);
    try {
      // Prepare data for upsert to evaluation_scores table
      const evaluationScores = criteria.map(criterion => {
        const formFieldName = createFieldName(criterion.name);
        const score = formData[formFieldName] || 0;
        
        return {
          employee_id: employee.id,
          criteria_id: criterion.id,
          score: score
        };
      });

      console.log('Upserting evaluation scores:', evaluationScores);

      // Upsert evaluation scores
      const { error } = await supabase
        .from('evaluation_scores')
        .upsert(evaluationScores, { 
          onConflict: 'employee_id,criteria_id' 
        });

      if (error) throw error;

      // Update the employee object with new values for UI consistency
      const updatedEmployee: Employee = {
        ...employee,
        // Map data back to Employee interface format
        kualitasKerja: formData[createFieldName('Kualitas Kerja')] || employee.kualitasKerja,
        tanggungJawab: formData[createFieldName('Tanggung Jawab')] || employee.tanggungJawab,
        kuantitasKerja: formData[createFieldName('Kuantitas Kerja')] || employee.kuantitasKerja,
        pemahamanTugas: formData[createFieldName('Pemahaman Tugas')] || employee.pemahamanTugas,
        inisiatif: formData[createFieldName('Inisiatif')] || employee.inisiatif,
        kerjasama: formData[createFieldName('Kerjasama')] || employee.kerjasama,
        hariAlpa: formData[createFieldName('Jumlah Hari Alpa')] || employee.hariAlpa,
        keterlambatan: formData[createFieldName('Jumlah Keterlambatan')] || employee.keterlambatan,
        hariIzin: formData[createFieldName('Jumlah Hari Izin')] || employee.hariIzin,
        hariSakit: formData[createFieldName('Jumlah Hari Sakit')] || employee.hariSakit,
        pulangCepat: formData[createFieldName('Pulang Cepat')] || employee.pulangCepat,
        prestasi: formData[createFieldName('Prestasi')] || employee.prestasi,
        suratPeringatan: formData[createFieldName('Surat Peringatan')] || employee.suratPeringatan
      };

      onUpdate(updatedEmployee);
      onClose();

      toast({
        title: "Berhasil",
        description: "Data evaluasi karyawan berhasil diperbarui",
      });
    } catch (error) {
      console.error('Error updating evaluation:', error);
      toast({
        title: "Error",
        description: "Gagal memperbarui data evaluasi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  // Group criteria by category for dynamic form rendering
  const groupedCriteria = criteria.reduce((acc, criterion) => {
    if (!acc[criterion.category]) {
      acc[criterion.category] = [];
    }
    acc[criterion.category].push(criterion);
    return acc;
  }, {} as { [key: string]: Criteria[] });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Evaluasi Karyawan - {employee.name}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dynamic form based on criteria from database */}
          {Object.entries(groupedCriteria).map(([category, criteriaList]) => (
            <div key={category} className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {criteriaList.map((criterion) => {
                  const fieldName = createFieldName(criterion.name);
                  const currentValue = formData[fieldName] || 0;
                  
                  return (
                    <div key={criterion.id}>
                      <Label htmlFor={fieldName}>
                        {criterion.name} ({criterion.scale})
                      </Label>
                      <Input
                        id={fieldName}
                        type="number"
                        min={criterion.type === 'Benefit' && criterion.scale.includes('1-5') ? "1" : "0"}
                        max={criterion.scale.includes('1-5') ? "5" : criterion.scale.includes('0-1') || criterion.scale.includes('0/1') ? "1" : "10"}
                        value={currentValue}
                        onChange={(e) => handleInputChange(fieldName, parseInt(e.target.value) || 0)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Bobot: {criterion.weight}% | Tipe: {criterion.type} | Field: {fieldName}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Fallback for when criteria are not loaded yet */}
          {criteria.length === 0 && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Memuat kriteria...</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};