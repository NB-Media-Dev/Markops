import { Component, inject, OnInit, signal, computed, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeadTelecallingService, LeadItem } from '../../core/services/lead-telecalling.service';
import { UserManagementService } from '../../core/services/user-management.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leads.component.html',
  styleUrl: './leads.component.scss',
})
export class LeadsComponent implements OnInit {
  @Input() embedded: boolean = false;

  readonly Math = Math;
  readonly leadService = inject(LeadTelecallingService);
  readonly userMgmtService = inject(UserManagementService);
  readonly authService = inject(AuthService);

  readonly activeTab = signal<'LEADS_LIST' | 'TELECALLING_MONITOR'>('LEADS_LIST');
  readonly showModal = signal<boolean>(false);
  readonly showExcelModal = signal<boolean>(false);
  readonly filterStatus = signal<string>('ALL');

  // Single Manual Lead Form
  newFirstName = '';
  newLastName = '';
  newEmail = '';
  newPhone = '';
  newSource = 'Organic / Search';

  // Manual Assign Modal
  selectedLeadForAssign: LeadItem | null = null;
  selectedUserId = '';
  assigneeName = '';

  // Excel Upload & Equal Auto-Assignment Form State
  campaignName = 'Q3 Digital Growth Campaign';
  leadSource = 'Digital Ads Lead Form';
  excelRawText = '';
  parsedLeads = signal<any[]>([]);
  uploadSuccessMessage = signal<string | null>(null);
  uploadValidationError = signal<string | null>(null);
  selectedTelecallerIds = signal<string[]>([]);

  // Permissions: Digital Marketing role & Admin only allowed to upload/create leads
  readonly canUploadLeads = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    const role = user.role ? String(user.role).toUpperCase() : '';
    return (
      role.includes('DIGITAL') ||
      role.includes('MARKETING') ||
      role.includes('ADMIN')
    );
  });

  readonly isTelecaller = computed(() => {
    const user = this.authService.currentUser();
    return user?.role === 'TELECALLER';
  });

  // List of active telecallers available for equal distribution (STRICTLY TELECALLER role)
  readonly activeTelecallers = computed(() => {
    return this.userMgmtService
      .users()
      .filter((u) => u.isActive && u.role === 'TELECALLER');
  });

  readonly realUsersList = computed(() => this.userMgmtService.users().filter((u) => u.isActive && u.role === 'TELECALLER'));

  // Live calculation of equal division math (e.g. 30 leads / 3 telecallers = 10 leads each)
  readonly assignmentPreview = computed(() => {
    const totalLeads = this.parsedLeads().length;
    const selectedIds = this.selectedTelecallerIds();
    const telecallers = this.activeTelecallers().filter((tc) => selectedIds.includes(tc.id));
    const tcCount = telecallers.length;

    if (totalLeads === 0 || tcCount === 0) {
      return null;
    }

    const perTc = Math.floor(totalLeads / tcCount);
    const remainder = totalLeads % tcCount;

    const allocationList = telecallers.map((tc, index) => {
      const count = perTc + (index < remainder ? 1 : 0);
      return {
        id: tc.id,
        fullName: tc.fullName,
        count,
      };
    });

    return {
      totalLeads,
      tcCount,
      perTc,
      remainder,
      allocationList,
      formulaText: `${totalLeads} Leads ÷ ${tcCount} Telecallers = ${perTc} leads each${remainder > 0 ? ` (+1 extra for ${remainder} telecaller(s))` : ''}`,
    };
  });

  ngOnInit() {
    this.leadService.loadLeads().subscribe();
    this.leadService.loadCalls().subscribe();
    this.leadService.loadSummary().subscribe();

    // Select all telecallers by default for equal distribution
    const telecallers = this.activeTelecallers();
    if (telecallers.length > 0) {
      this.selectedTelecallerIds.set(telecallers.map((tc) => tc.id));
    }
  }

  downloadSampleCsv() {
    const headers = 'First Name,Last Name,Email,Phone,Source\n';
    const firstNames = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikas', 'Ananya', 'Rohan', 'Kavita', 'Sanjay', 'Meera', 
                        'Arjun', 'Pooja', 'Deepak', 'Ritu', 'Karan', 'Simran', 'Nitin', 'Divya', 'Siddharth', 'Neha', 
                        'Alok', 'Tanya', 'Varun', 'Shweta', 'Gaurav', 'Preeti', 'Abhishek', 'Monika', 'Rajesh', 'Sunita'];
    const lastNames = ['Sharma', 'Verma', 'Gupta', 'Patel', 'Singh', 'Kumar', 'Joshi', 'Mehta', 'Chawla', 'Nair',
                       'Reddy', 'Rao', 'Deshmukh', 'Bhat', 'Roy', 'Sen', 'Dutta', 'Das', 'Kapoor', 'Malhotra',
                       'Khanna', 'Bhasin', 'Bansal', 'Agarwal', 'Choudhury', 'Iyer', 'Menon', 'Pillai', 'Pandey', 'Mishra'];

    let rows = '';
    for (let i = 0; i < 30; i++) {
      rows += `${firstNames[i]},${lastNames[i]},${firstNames[i].toLowerCase()}@example.com,+91 98${Math.floor(10000000 + Math.random() * 90000000)},Digital Lead Gen\n`;
    }

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Sample_30_Leads_Upload.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.excelRawText = text;
      this.parseCsvText(text);
    };

    reader.readAsText(file);
  }

  parseCsvText(text: string) {
    this.uploadValidationError.set(null);
    if (!text || !text.trim()) {
      this.parsedLeads.set([]);
      return;
    }

    const lines = text.trim().split('\n');
    const parsed: any[] = [];
    const missingErrors: string[] = [];

    let leadIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip header if line includes 'first' or 'name' or 'email'
      if (i === 0 && (line.toLowerCase().includes('first') || line.toLowerCase().includes('phone') || line.toLowerCase().includes('email'))) {
        continue;
      }

      leadIndex++;
      const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      
      const firstName = parts[0] || '';
      const lastName = parts[1] || '';
      const email = parts[2] || '';
      const phone = parts[3] || '';
      const source = parts[4] || '';

      if (!firstName || !lastName || !email || !phone || !source) {
        const missing: string[] = [];
        if (!firstName) missing.push('First Name');
        if (!lastName) missing.push('Last Name');
        if (!email) missing.push('Email');
        if (!phone) missing.push('Phone');
        if (!source) missing.push('Source');
        missingErrors.push(`Row #${leadIndex}: Missing (${missing.join(', ')})`);
      }

      parsed.push({
        firstName,
        lastName,
        email,
        phone,
        source,
      });
    }

    if (missingErrors.length > 0) {
      this.uploadValidationError.set(`Validation Error: All 5 fields (First Name, Last Name, Email, Phone, Source) are required. ${missingErrors.slice(0, 3).join(' | ')}${missingErrors.length > 3 ? ` ...and ${missingErrors.length - 3} more row(s)` : ''}`);
    }

    this.parsedLeads.set(parsed);
  }

  toggleTelecallerSelection(id: string) {
    const current = this.selectedTelecallerIds();
    if (current.includes(id)) {
      this.selectedTelecallerIds.set(current.filter((i) => i !== id));
    } else {
      this.selectedTelecallerIds.set([...current, id]);
    }
  }

  openExcelModal() {
    if (!this.canUploadLeads()) {
      alert('Access Denied: Only Digital Marketing and Admin roles are authorized to upload lead files.');
      return;
    }
    this.showExcelModal.set(true);
    this.uploadSuccessMessage.set(null);
  }

  closeExcelModal() {
    this.showExcelModal.set(false);
  }

  submitEqualAutoAssignment() {
    if (!this.canUploadLeads()) {
      alert('Access Denied: Telecallers are not permitted to upload lead files. Only Digital Marketing role can upload.');
      return;
    }

    const leads = this.parsedLeads();
    if (leads.length === 0) {
      alert('Please select or upload a valid lead file to assign.');
      return;
    }

    // Check for empty fields in any parsed lead
    const invalidLeads = leads.filter(
      (l) => !l.firstName?.trim() || !l.lastName?.trim() || !l.email?.trim() || !l.phone?.trim() || !l.source?.trim()
    );

    if (invalidLeads.length > 0) {
      alert('Validation Error: All 5 fields (First Name, Last Name, Email, Phone, Source) are strictly required for every lead in the file. Please make sure no fields are empty.');
      return;
    }

    const selectedIds = this.selectedTelecallerIds();
    if (selectedIds.length === 0) {
      alert('Please select at least 1 active telecaller to receive the equal assignment.');
      return;
    }

    const user = this.authService.currentUser();
    const activeSelectedTcs = this.activeTelecallers().filter((tc) => selectedIds.includes(tc.id));

    this.leadService
      .batchImportLeads({
        leads,
        selectedTelecallerIds: selectedIds,
        telecallersList: activeSelectedTcs.map((tc) => ({ id: tc.id, fullName: tc.fullName, email: tc.email })),
        campaignName: this.campaignName,
        source: this.leadSource,
        uploaderId: user?.id,
        uploaderEmail: user?.email,
        uploaderRole: user?.role,
      })
      .subscribe({
        next: (res) => {
          this.uploadSuccessMessage.set(
            `Success! ${res.totalUploaded} leads uploaded and distributed equally (${res.leadsPerTelecaller} leads each across ${res.telecallersCount} telecallers).`
          );
          setTimeout(() => {
            this.closeExcelModal();
            this.activeTab.set('TELECALLING_MONITOR');
          }, 1800);
        },
        error: (err) => {
          alert('Error during batch lead assignment: ' + (err?.error?.error || err?.message || 'Server error'));
        },
      });
  }

  // Single Lead methods
  openModal() {
    if (!this.canUploadLeads()) {
      alert('Access Denied: Only Digital Marketing and Admin roles can create leads.');
      return;
    }
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  createLead() {
    if (!this.newFirstName?.trim() || !this.newLastName?.trim() || !this.newEmail?.trim() || !this.newPhone?.trim() || !this.newSource?.trim()) {
      alert('Validation Error: All fields (First Name, Last Name, Email, Phone, and Source) are strictly required.');
      return;
    }

    this.leadService
      .createLead({
        firstName: this.newFirstName.trim(),
        lastName: this.newLastName.trim(),
        email: this.newEmail.trim(),
        phone: this.newPhone.trim(),
        source: this.newSource.trim(),
      })
      .subscribe({
        next: () => {
          this.closeModal();
          this.newFirstName = '';
          this.newLastName = '';
          this.newEmail = '';
          this.newPhone = '';
        },
        error: (err) => {
          alert('Error creating lead: ' + (err?.error?.error || err?.message || 'Server error'));
        },
      });
  }

  assignLead(lead: LeadItem) {
    this.selectedLeadForAssign = lead;
    const users = this.realUsersList();
    if (users.length > 0) {
      this.selectedUserId = users[0].id;
      this.assigneeName = `${users[0].fullName} (${users[0].role})`;
    } else {
      this.selectedUserId = '';
      this.assigneeName = 'Unassigned';
    }
  }

  onUserSelectChange(event: Event) {
    const userId = (event.target as HTMLSelectElement).value;
    const found = this.realUsersList().find((u) => u.id === userId);
    if (found) {
      this.selectedUserId = found.id;
      this.assigneeName = `${found.fullName} (${found.role})`;
    }
  }

  confirmAssign() {
    if (!this.selectedLeadForAssign || !this.selectedUserId) return;
    this.leadService.assignLead(this.selectedLeadForAssign.id, this.selectedUserId, this.assigneeName).subscribe(() => {
      this.selectedLeadForAssign = null;
    });
  }

  readonly myLeadsList = computed(() => {
    let list = this.leadService.leads();
    const user = this.authService.currentUser();

    if (user && user.role === 'TELECALLER') {
      list = list.filter(
        (l) =>
          (l.assignedTo && l.assignedTo === user.id) ||
          (l.assignedTo && user.email && l.assignedTo.toLowerCase() === user.email.toLowerCase()) ||
          (l.assigneeName && user.fullName && l.assigneeName.toLowerCase().includes(user.fullName.toLowerCase()))
      );
    }
    return list;
  });

  get filteredLeads(): LeadItem[] {
    let list = this.myLeadsList();
    const st = this.filterStatus();
    if (st === 'ALL') return list;
    return list.filter((l) => l.status === st);
  }
}

