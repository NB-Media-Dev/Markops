import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { UserManagementService } from '../../core/services/user-management.service';
import { UserRole } from '../../core/models/auth.model';
import { ManagedUser, SYSTEM_ROLES_METADATA } from '../../core/models/user-management.model';

@Component({
  selector: 'app-users-roles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './users-roles.component.html',
  styleUrl: './users-roles.component.scss',
})
export class UsersRolesComponent {
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);
  readonly userMgmtService = inject(UserManagementService);

  readonly systemRoles = SYSTEM_ROLES_METADATA;

  readonly userSearchQuery = signal<string>('');
  readonly selectedRoleFilter = signal<string>('ALL');

  // Create User Signals & Form
  readonly isCreateUserModalOpen = signal<boolean>(false);
  readonly createFormSubmitted = signal<boolean>(false);
  readonly showCreatePassword = signal<boolean>(false);
  readonly userSuccessMsg = signal<string | null>(null);

  // Common Password Validation Rules (Minimum 6 characters, required on create)
  readonly createUserForm: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['MARKETING_MANAGER' as UserRole, [Validators.required]],
    department: ['General Operations'],
    password: ['', [Validators.required, Validators.minLength(6)]],
    isActive: [true],
  });

  // Edit User Signals & Form
  readonly isEditUserModalOpen = signal<boolean>(false);
  readonly editFormSubmitted = signal<boolean>(false);
  readonly editingUserId = signal<string | null>(null);
  readonly showEditPassword = signal<boolean>(false);

  readonly editUserForm: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['MARKETING_MANAGER' as UserRole, [Validators.required]],
    department: ['General Operations'],
    password: ['', [Validators.minLength(6)]],
    isActive: [true],
  });

  readonly filteredUsers = computed(() => {
    const allUsers = this.userMgmtService.users();
    const query = this.userSearchQuery().toLowerCase().trim();
    const roleFilter = this.selectedRoleFilter();

    return allUsers.filter((user) => {
      const matchesSearch =
        !query ||
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);

      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  });

  // Create Modal Actions
  openCreateUserModal(): void {
    this.createUserForm.reset({
      fullName: '',
      email: '',
      role: 'MARKETING_MANAGER',
      department: 'Growth Operations',
      password: '',
      isActive: true,
    });
    this.createFormSubmitted.set(false);
    this.showCreatePassword.set(false);
    this.isCreateUserModalOpen.set(true);
  }

  closeCreateUserModal(): void {
    this.isCreateUserModalOpen.set(false);
  }

  toggleCreatePasswordVisibility(): void {
    this.showCreatePassword.update((v) => !v);
  }

  onSubmitCreateUser(): void {
    this.createFormSubmitted.set(true);

    if (this.createUserForm.invalid) {
      this.createUserForm.markAllAsTouched();
      return;
    }

    const newUser = this.userMgmtService.createUser(this.createUserForm.value);
    this.userSuccessMsg.set(`User "${newUser.fullName}" (${newUser.email}) created successfully!`);
    this.closeCreateUserModal();

    setTimeout(() => {
      this.userSuccessMsg.set(null);
    }, 4000);
  }

  // Edit Modal Actions
  openEditUserModal(user: ManagedUser): void {
    this.editingUserId.set(user.id);
    this.editUserForm.patchValue({
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
      password: '',
      isActive: user.isActive,
    });
    this.editFormSubmitted.set(false);
    this.showEditPassword.set(false);
    this.isEditUserModalOpen.set(true);
  }

  closeEditUserModal(): void {
    this.isEditUserModalOpen.set(false);
    this.editingUserId.set(null);
  }

  toggleEditPasswordVisibility(): void {
    this.showEditPassword.update((v) => !v);
  }

  onSubmitEditUser(): void {
    this.editFormSubmitted.set(true);

    if (this.editUserForm.invalid) {
      this.editUserForm.markAllAsTouched();
      return;
    }

    const id = this.editingUserId();
    if (!id) return;

    const updated = this.userMgmtService.updateUser(id, this.editUserForm.value);
    if (updated) {
      this.userSuccessMsg.set(`User "${updated.fullName}" account updated successfully!`);
    }
    this.closeEditUserModal();

    setTimeout(() => {
      this.userSuccessMsg.set(null);
    }, 4000);
  }

  // Search & Filter Actions
  onSearchUser(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.userSearchQuery.set(val);
  }

  onFilterRole(roleCode: string): void {
    this.selectedRoleFilter.set(roleCode);
  }

  // Status & Delete Actions
  toggleUserStatus(user: ManagedUser): void {
    this.userMgmtService.toggleUserStatus(user.id);
  }

  deleteUser(user: ManagedUser): void {
    if (user.id === 'usr_admin_01') {
      alert('System Administrator account is protected and cannot be deleted.');
      return;
    }
    if (confirm(`Are you sure you want to delete user "${user.fullName}" (${user.email})?`)) {
      this.userMgmtService.deleteUser(user.id);
      this.userSuccessMsg.set(`User record for "${user.fullName}" removed.`);
      setTimeout(() => this.userSuccessMsg.set(null), 3000);
    }
  }

  getDeptCategoryClass(department: string): string {
    const dept = (department || '').toLowerCase();
    if (dept.includes('exec') || dept.includes('admin') || dept.includes('management')) {
      return 'exec';
    }
    if (dept.includes('growth') || dept.includes('strategy') || dept.includes('marketing')) {
      return 'growth';
    }
    if (dept.includes('media') || dept.includes('paid') || dept.includes('digital') || dept.includes('ads')) {
      return 'media';
    }
    if (dept.includes('creative') || dept.includes('design') || dept.includes('brand') || dept.includes('studio')) {
      return 'creative';
    }
    if (dept.includes('sale') || dept.includes('inside') || dept.includes('call') || dept.includes('tele')) {
      return 'sales';
    }
    if (dept.includes('account') || dept.includes('revenue') || dept.includes('convert') || dept.includes('finance')) {
      return 'finance';
    }
    return 'general';
  }
}
