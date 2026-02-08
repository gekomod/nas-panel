<template>
  <div class="filesystems-dashboard">
    <!-- Compact Header -->
    <el-card class="dashboard-header compact" shadow="hover">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon small">
            <Icon icon="mdi:file-tree" />
          </div>
          <div class="header-text">
            <h2>{{ $t('storageFilesystems.title') }}</h2>
            <p class="subtitle">{{ $t('storageFilesystems.subtitle') || 'Manage filesystems and storage devices' }}</p>
          </div>
        </div>
        
        <!-- Stats Section -->
        <div class="header-stats">
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:harddisk" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ filesystems.length }}</div>
              <div class="stat-label">Filesystems</div>
            </div>
          </div>
          
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:chart-pie" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ totalUsedPercent }}%</div>
              <div class="stat-label">Used</div>
            </div>
          </div>
          
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:database" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ formatBytes(totalCapacity) }}</div>
              <div class="stat-label">Capacity</div>
            </div>
          </div>
          
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon icon="mdi:auto-fix" width="14" />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ autoMountCount }}</div>
              <div class="stat-label">Auto-mount</div>
            </div>
          </div>
          
          <div class="stat-item small">
            <div class="stat-icon">
              <Icon :icon="getThemeIcon" width="14" />
            </div>
            <div class="stat-info">
              <el-switch
                v-model="darkMode"
                @change="toggleTheme"
                size="small"
                style="margin-top: 4px;"
              />
              <div class="stat-label">Theme</div>
            </div>
          </div>
        </div>
        
        <!-- Filter Buttons -->
        <div class="header-actions compact">
          <el-button-group>
            <el-button 
              :type="viewFilter === 'all' ? 'primary' : 'default'"
              @click="viewFilter = 'all'"
              size="small"
            >
              All
            </el-button>
            <el-button 
              :type="viewFilter === 'raid' ? 'primary' : 'default'"
              @click="viewFilter = 'raid'"
              size="small"
            >
              RAID
            </el-button>
            <el-button 
              :type="viewFilter === 'lvm' ? 'primary' : 'default'"
              @click="viewFilter = 'lvm'"
              size="small"
            >
              LVM
            </el-button>
            <el-button 
              :type="viewFilter === 'critical' ? 'primary' : 'default'"
              @click="viewFilter = 'critical'"
              size="small"
            >
              Critical
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>

    <!-- Quick Actions & Stats Combined -->
    <el-card class="combined-card" shadow="hover">
      <div class="combined-content">
        <!-- Quick Actions -->
        <div class="quick-actions">
          <el-button-group>
            <el-button 
              @click="showMountDialog" 
              :disabled="loading"
              size="small"
            >
              <Icon icon="streamline-cyber-color:harddisk-4" width="14" />
              Mount
            </el-button>
            
            <el-button 
              @click="showPartitionDialog" 
              :disabled="loading"
              size="small"
            >
              <Icon icon="mdi:harddisk-plus" width="14" />
              Partition
            </el-button>
            
            <el-button 
              @click="showFormatDialog" 
              :disabled="loading"
              size="small"
            >
              <Icon icon="icon-park:clear-format" width="14" />
              Format
            </el-button>
            
            <el-button 
              @click="showRaidDialog" 
              :disabled="loading"
              size="small"
            >
              <Icon icon="icon-park:solid-state-disk" width="14" />
              RAID
            </el-button>
            
            <el-button 
              @click="showLvmDialog" 
              :disabled="loading"
              size="small"
            >
              <Icon icon="mdi:layers" width="14" />
              LVM
            </el-button>
          </el-button-group>
          
          <div class="right-actions">
            <el-button 
              @click="openFstabEditor" 
              :disabled="loading"
              size="small"
              plain
            >
              <Icon icon="mdi:file-edit" width="14" />
              Edit fstab
            </el-button>
            
            <el-button 
              @click="debugDevices" 
              :disabled="loading"
              size="small"
              plain
              type="warning"
            >
              <Icon icon="mdi:bug" width="14" />
              Debug
            </el-button>
            
            <el-button 
              @click="refreshFilesystems" 
              :loading="loading"
              size="small"
              plain
            >
              <Icon icon="mdi:refresh" width="14" :class="{ 'spin': loading }" />
              Refresh
            </el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Filesystems List - NEW MODERN DESIGN -->
    <el-card class="filesystems-list-card modern-table" shadow="hover">
      <!-- Search & Filters -->
      <div class="list-header modern">
        <div class="search-section">
          <el-input
            v-model="searchQuery"
            placeholder="Search filesystems..."
            clearable
            size="small"
            class="search-input modern"
          >
            <template #prefix>
              <Icon icon="mdi:magnify" width="14" />
            </template>
          </el-input>
          
          <el-select 
            v-model="typeFilter" 
            placeholder="Filesystem Type" 
            clearable
            size="small"
            class="filter-select modern"
          >
            <el-option label="ext4" value="ext4" />
            <el-option label="xfs" value="xfs" />
            <el-option label="btrfs" value="btrfs" />
            <el-option label="zfs" value="zfs" />
            <el-option label="ntfs" value="ntfs" />
            <el-option label="vfat" value="vfat" />
          </el-select>
          
          <el-select 
            v-model="statusFilter" 
            placeholder="Status" 
            clearable
            size="small"
            class="filter-select modern"
          >
            <el-option label="Active" value="active" />
            <el-option label="Inactive" value="inactive" />
            <el-option label="Read Only" value="readonly" />
            <el-option label="Error" value="error" />
          </el-select>
        </div>
        
        <div class="sort-section">
          <el-select 
            v-model="sortBy" 
            placeholder="Sort by"
            size="small"
            class="sort-select"
          >
            <el-option label="Name" value="device" />
            <el-option label="Usage" value="usedPercent" />
            <el-option label="Size" value="size" />
            <el-option label="Status" value="status" />
          </el-select>
          
          <el-button 
            @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
            size="small"
            text
            class="sort-btn"
          >
            <Icon :icon="sortOrder === 'asc' ? 'mdi:sort-ascending' : 'mdi:sort-descending'" width="16" />
          </el-button>
        </div>
      </div>

      <!-- Error Alert -->
      <el-alert 
        v-if="error" 
        :title="error" 
        type="error" 
        show-icon 
        closable 
        @close="error = null"
        size="small"
        class="modern-alert"
      />

      <!-- Loading State -->
      <div v-if="loading && filesystems.length === 0" class="loading-state modern">
        <div class="spinner-container">
          <div class="spinner"></div>
        </div>
        <span class="loading-text">Loading filesystems...</span>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredFilesystems.length === 0 && !loading" class="empty-state modern">
        <div class="empty-illustration">
          <Icon icon="mdi:database-outline" width="64" />
        </div>
        <div class="empty-content">
          <h4>No Filesystems Found</h4>
          <p>{{ emptyMessage }}</p>
          <el-button type="primary" size="small" @click="showMountDialog" class="empty-action-btn">
            <Icon icon="streamline-cyber-color:harddisk-4" width="14" />
            Mount First Device
          </el-button>
        </div>
      </div>

      <!-- Modern Filesystems Grid -->
      <div v-else class="filesystems-grid">
        <div 
          v-for="fs in paginatedFilesystems" 
          :key="fs.device"
          class="filesystem-card"
          :class="{
            'critical': fs.usedPercent > 90,
            'warning': fs.usedPercent > 70 && fs.usedPercent <= 90,
            'selected': selectedFs && selectedFs.device === fs.device
          }"
          @click="toggleSelection(fs)"
        >
          <!-- Card Header -->
          <div class="card-header">
            <div class="device-info">
              <div class="device-icon">
                <el-icon :size="24" :color="getFsColor(fs.type)">
                  <Icon :icon="getFsIcon(fs.type)" />
                </el-icon>
                <div class="device-status-indicator" :class="fs.status"></div>
              </div>
              <div class="device-details">
                <h4 class="device-name">{{ getDeviceShortName(fs.device) }}</h4>
                <div class="device-path">{{ fs.device }}</div>
              </div>
            </div>
            
            <div class="card-actions">
              <el-dropdown trigger="click" placement="bottom-end">
                <el-button size="small" text circle class="action-btn">
                  <Icon icon="mdi:dots-vertical" width="16" />
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click.stop="showDeviceDetails(fs)">
                      <Icon icon="mdi:information-outline" width="16" />
                      Details
                    </el-dropdown-item>
                    <el-dropdown-item 
                      @click.stop="unmountFilesystem(fs.mounted)"
                      :disabled="fs.status !== 'active'"
                    >
                      <Icon icon="mdi:eject" width="16" />
                      Unmount
                    </el-dropdown-item>
                    <el-dropdown-item @click.stop="editFstabEntry(fs)">
                      <Icon icon="mdi:pencil" width="16" />
                      Edit fstab
                    </el-dropdown-item>
                    <el-dropdown-item @click.stop="repairFilesystem(fs)" :disabled="fs.status !== 'active'">
                      <Icon icon="mdi:wrench" width="16" />
                      Repair
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <!-- Card Tags -->
          <div class="card-tags">
            <el-tag v-if="isRaidDevice(fs.device)" size="mini" type="warning" effect="dark">
              RAID
            </el-tag>
            <el-tag v-else-if="isLvmDevice(fs.device)" size="mini" type="success" effect="dark">
              LVM
            </el-tag>
            <el-tag v-else-if="fs.type === 'zfs'" size="mini" type="info" effect="dark">
              ZFS
            </el-tag>
            <el-tag v-if="fs.inFstab" size="mini" type="success" effect="plain">
              <Icon icon="mdi:auto-fix" width="10" />
              Auto
            </el-tag>
            <el-tag v-if="fs.readOnly" size="mini" type="warning" effect="plain">
              <Icon icon="mdi:lock" width="10" />
              RO
            </el-tag>
            <el-tag :type="getStatusType(fs.status)" size="mini" :effect="fs.status === 'active' ? 'dark' : 'plain'">
              <Icon :icon="getStatusIcon(fs.status)" width="10" />
              {{ fs.status }}
            </el-tag>
          </div>

          <!-- Mount Info -->
          <div v-if="fs.mounted" class="mount-info">
            <Icon icon="mdi:folder" width="12" />
            <span class="mount-path">{{ truncatePath(fs.mounted, 40) }}</span>
          </div>

          <!-- Usage Stats -->
          <div class="usage-section">
            <div class="usage-header">
              <span class="usage-label">Storage Usage</span>
              <span class="usage-percent">{{ fs.usedPercent }}%</span>
            </div>
            <el-progress 
              :percentage="fs.usedPercent" 
              :color="getUsageColor(fs.usedPercent)"
              :show-text="false"
              :stroke-width="8"
              class="usage-bar modern"
            />
            <div class="usage-details">
              <span class="used">{{ formatBytes(fs.used) }}</span>
              <span class="separator">/</span>
              <span class="total">{{ formatBytes(fs.size) }}</span>
              <span class="free">({{ formatBytes(fs.size - fs.used) }} free)</span>
            </div>
          </div>

          <!-- Filesystem Type -->
          <div class="filesystem-type">
            <el-tag size="mini" effect="plain" class="fs-type-tag">
              {{ fs.type.toUpperCase() }}
            </el-tag>
            <span class="fs-size">{{ formatBytes(fs.size) }}</span>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="!loading && filteredFilesystems.length > 0" class="pagination modern">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="filteredFilesystems.length"
          :page-sizes="[9, 18, 36, 72]"
          layout="total, sizes, prev, pager, next"
          size="small"
          background
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- Mount Dialog -->
    <el-dialog 
      v-model="mountDialogVisible" 
      title="Mount Device" 
      width="600px"
      class="storage-dialog"
    >
      <el-form :model="mountForm" label-position="top" size="small">
        <el-form-item label="Device" required>
          <el-select 
            v-model="mountForm.device" 
            placeholder="Select device to mount" 
            @change="onDeviceSelected"
            filterable
            class="full-width"
          >
            <el-option-group label="Disks">
              <el-option
                v-for="device in allAvailableDevices"
                :key="device.path"
                :label="getDeviceLabel(device)"
                :value="device.path"
              >
                <div class="device-select-option">
                  <Icon :icon="getDeviceIcon(device.path)" width="16" />
                  <span class="device-name">{{ device.path }}</span>
                  <span class="device-meta">{{ device.model || 'Unknown' }} • {{ formatBytes(device.size) }}</span>
                </div>
              </el-option>
            </el-option-group>
            
            <el-option-group label="Partitions">
              <el-option
                v-for="partition in allAvailablePartitions"
                :key="partition.path"
                :label="getDeviceLabel(partition)"
                :value="partition.path"
              >
                <div class="device-select-option">
                  <Icon icon="mdi:harddisk-partition" width="16" />
                  <span class="device-name">{{ partition.path }}</span>
                  <span class="device-meta">{{ partition.fstype || 'Unknown' }} • {{ formatBytes(partition.size) }}</span>
                </div>
              </el-option>
            </el-option-group>
            
            <el-option-group label="RAID Arrays" v-if="raidDevices.length > 0">
              <el-option
                v-for="raid in raidDevices"
                :key="raid.path"
                :label="getDeviceLabel(raid)"
                :value="raid.path"
              >
                <div class="device-select-option">
                  <Icon icon="mdi:raid" width="16" />
                  <span class="device-name">{{ raid.path }}</span>
                  <span class="device-meta">RAID • {{ formatBytes(raid.size) }}</span>
                </div>
              </el-option>
            </el-option-group>
            
            <el-option-group label="LVM Volumes" v-if="lvmVolumes.length > 0">
              <el-option
                v-for="lvm in lvmVolumes"
                :key="lvm.path"
                :label="getDeviceLabel(lvm)"
                :value="lvm.path"
              >
                <div class="device-select-option">
                  <Icon icon="mdi:layers" width="16" />
                  <span class="device-name">{{ lvm.path }}</span>
                  <span class="device-meta">LVM • {{ formatBytes(lvm.size) }}</span>
                </div>
              </el-option>
            </el-option-group>
          </el-select>
        </el-form-item>
        
        <div v-if="selectedDeviceInfo" class="device-info-card">
          <h4>Device Information</h4>
          <div class="info-grid">
            <div class="info-row">
              <span class="info-label">Filesystem:</span>
              <el-tag size="small">{{ selectedDeviceInfo.fsType || 'Unknown' }}</el-tag>
            </div>
            <div class="info-row">
              <span class="info-label">Size:</span>
              <span class="info-value">{{ formatBytes(selectedDeviceInfo.size) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Label:</span>
              <span class="info-value">{{ selectedDeviceInfo.label || 'None' }}</span>
            </div>
            <div v-if="selectedDeviceInfo.isRaid" class="info-row">
              <span class="info-label">Type:</span>
              <el-tag type="warning" size="small">RAID Device</el-tag>
            </div>
            <div v-if="selectedDeviceInfo.isLvm" class="info-row">
              <span class="info-label">Type:</span>
              <el-tag type="success" size="small">LVM Volume</el-tag>
            </div>
            <div v-if="selectedDeviceInfo.isZfs" class="info-row">
              <span class="info-label">Type:</span>
              <el-tag type="primary" size="small">ZFS Pool</el-tag>
            </div>
          </div>
        </div>
        
        <el-form-item 
          v-if="!selectedDeviceInfo?.isZfs && !selectedDeviceInfo?.isLvm"
          label="Mount Point" 
          required
        >
          <el-input 
            v-model="mountForm.mountPoint" 
            :placeholder="getDefaultMountPoint()"
          />
        </el-form-item>
        
        <el-form-item 
          v-if="!selectedDeviceInfo?.fsType && !selectedDeviceInfo?.isZfs && !selectedDeviceInfo?.isLvm"
          label="Filesystem Type"
        >
          <el-select v-model="mountForm.fsType" class="full-width">
            <el-option label="Auto Detect" value="auto" />
            <el-option
              v-for="fs in supportedFilesystems"
              :key="fs"
              :label="fs.toUpperCase()"
              :value="fs.toLowerCase()"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item 
          v-if="selectedDeviceInfo?.isZfs"
          label="ZFS Pool Name"
          required
        >
          <el-input v-model="mountForm.zfsPoolName" placeholder="zpool" />
        </el-form-item>
        
        <el-form-item 
          v-if="selectedDeviceInfo?.isLvm"
          label="LVM Volume Group"
        >
          <el-input v-model="mountForm.lvmVolumeGroup" :placeholder="getLvmVolumeGroup(selectedDeviceInfo.path)" disabled />
        </el-form-item>
        
        <el-form-item 
          v-if="!selectedDeviceInfo?.isZfs && !selectedDeviceInfo?.isLvm"
          label="Options"
        >
          <el-input v-model="mountForm.options" placeholder="defaults,nofail" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="mountDialogVisible = false" size="small">
            Cancel
          </el-button>
          <el-button 
            type="primary" 
            @click="mountDevice" 
            :loading="mountLoading"
            :disabled="!mountForm.device || (selectedDeviceInfo?.isZfs && !mountForm.zfsPoolName)"
            size="small"
          >
            Mount
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Format Dialog -->
    <el-dialog 
      v-model="formatDialogVisible" 
      title="Format Device" 
      width="550px"
      class="storage-dialog warning-dialog"
    >
      <el-form :model="formatForm" label-position="top" size="small">
        <el-form-item label="Device" required>
          <el-select 
            v-model="formatForm.device" 
            placeholder="Select device to format" 
            filterable
            class="full-width"
          >
            <el-option-group label="Partitions">
              <el-option
                v-for="partition in allAvailablePartitions"
                :key="partition.path"
                :label="`${partition.path} (${partition.model || 'Unknown'})`"
                :value="partition.path"
              >
                <div class="device-select-option">
                  <Icon icon="mdi:harddisk-partition" width="16" />
                  <span class="device-name">{{ partition.path }}</span>
                  <span class="device-meta">{{ partition.fstype || 'Raw' }} • {{ formatBytes(partition.size) }}</span>
                </div>
              </el-option>
            </el-option-group>
            
            <el-option-group label="Disks">
              <el-option
                v-for="device in allAvailableDevices"
                :key="device.path"
                :label="`${device.path} (${device.model || 'Unknown'})`"
                :value="device.path"
              >
                <div class="device-select-option">
                  <Icon :icon="getDeviceIcon(device.path)" width="16" />
                  <span class="device-name">{{ device.path }}</span>
                  <span class="device-meta">Disk • {{ formatBytes(device.size) }}</span>
                </div>
              </el-option>
            </el-option-group>
          </el-select>
        </el-form-item>
        
        <el-form-item label="Filesystem Type" required>
          <el-select v-model="formatForm.fsType" class="full-width">
            <el-option
              v-for="fs in supportedFilesystems"
              :key="fs"
              :label="fs.toUpperCase()"
              :value="fs.toLowerCase()"
            >
              <div class="fs-option">
                <Icon :icon="getFsIcon(fs)" width="16" />
                <span>{{ fs.toUpperCase() }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        
        <div v-if="formatForm.fsType === 'zfs'" class="warning-section">
          <el-alert type="warning" :closable="false" size="small">
            <template #title>
              <strong>ZFS requires entire disk!</strong>
            </template>
            ZFS will use the entire disk (e.g., /dev/sda instead of /dev/sda1)
          </el-alert>
        </div>
        
        <el-form-item 
          v-if="formatForm.fsType === 'zfs'"
          label="ZFS Pool Name"
          required
        >
          <el-input v-model="formatForm.zfsPoolName" placeholder="mypool" />
        </el-form-item>
        
        <el-form-item 
          v-else
          label="Label"
        >
          <el-input v-model="formatForm.label" :placeholder="`${formatForm.fsType.toUpperCase()}_VOLUME`" />
        </el-form-item>
        
        <el-form-item label="Force Format">
          <el-switch v-model="formatForm.force" />
          <span class="switch-label">Force format even if device contains data</span>
        </el-form-item>
        
        <div class="warning-section">
          <el-alert type="error" :closable="false" size="small">
            <template #title>
              <strong>WARNING: DATA LOSS</strong>
            </template>
            All data on <strong>{{ formatForm.device }}</strong> will be permanently deleted!
          </el-alert>
        </div>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="formatDialogVisible = false" size="small">
            Cancel
          </el-button>
          <el-button 
            type="danger" 
            @click="formatDevice" 
            :loading="formatLoading"
            :disabled="!formatForm.device || !formatForm.fsType"
            size="small"
          >
            Format
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Partition Dialog -->
    <el-dialog 
      v-model="partitionDialogVisible" 
      title="Partition Disk" 
      width="700px"
      class="storage-dialog"
    >
      <el-form :model="partitionForm" label-position="top" size="small">
        <el-form-item label="Device" required>
          <el-select 
            v-model="partitionForm.device" 
            class="full-width"
            @change="checkSystemDisk"
            filterable
          >
            <el-option
              v-for="device in partitionableDevices"
              :key="device.path"
              :label="`${device.path} (${device.model || 'Unknown'})`"
              :value="device.path"
              :disabled="isSystemDisk(device.path)"
            >
              <div class="device-select-option">
                <Icon :icon="getDeviceIcon(device.path)" width="16" />
                <span class="device-name">{{ device.path }}</span>
                <span class="device-meta">
                  {{ device.model || 'Unknown' }} • {{ formatBytes(device.size) }}
                </span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        
        <el-form-item v-if="partitionForm.device" label="Disk Usage">
          <div class="disk-usage-container">
            <div class="disk-info">
              <div class="disk-stat">
                <span class="disk-stat-label">Total:</span>
                <span class="disk-stat-value">{{ formatBytes(totalDiskSize) }}</span>
              </div>
              <div class="disk-stat">
                <span class="disk-stat-label">Allocated:</span>
                <span class="disk-stat-value">{{ formatBytes(usedDiskSpace) }}</span>
              </div>
              <div class="disk-stat">
                <span class="disk-stat-label">Free:</span>
                <span class="disk-stat-value">{{ formatBytes(totalDiskSize - usedDiskSpace) }}</span>
              </div>
            </div>
            <el-progress 
              :percentage="diskUsagePercentage"
              :color="getUsageColor(diskUsagePercentage)"
              :show-text="false"
              :stroke-width="12"
              class="disk-progress"
            />
            <div class="disk-percentage">
              <span>{{ diskUsagePercentage }}% allocated</span>
            </div>
          </div>
        </el-form-item>
        
        <el-form-item label="Partition Scheme">
          <el-radio-group v-model="partitionForm.scheme">
            <el-radio-button value="gpt">GPT (Modern)</el-radio-button>
            <el-radio-button value="mbr">MBR (Legacy)</el-radio-button>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="Partitions">
          <div class="partitions-section">
            <div class="partition-list">
              <div v-for="(part, index) in partitionForm.partitions" :key="index" class="partition-item">
                <div class="partition-header">
                  <span class="partition-number">Partition {{ index + 1 }}</span>
                  <el-button 
                    @click="removePartition(index)" 
                    type="danger" 
                    size="small"
                    text
                    circle
                    v-if="partitionForm.partitions.length > 1"
                  >
                    <Icon icon="mdi:close" />
                  </el-button>
                </div>
                <div class="partition-controls">
                  <div class="size-control">
                    <el-input-number 
                      v-model="part.size" 
                      :min="1" 
                      :max="getMaxSize(part)" 
                      :step="part.unit === '%' ? 1 : (part.unit === 'G' ? 10 : 100)"
                      :precision="0"
                      size="small"
                    />
                    <el-select 
                      v-model="part.unit" 
                      size="small"
                      @change="(val) => changePartitionUnit(part, val)"
                      class="unit-select"
                    >
                      <el-option label="MB" value="M" />
                      <el-option label="GB" value="G" />
                      <el-option label="%" value="%" />
                    </el-select>
                  </div>
                  <div class="type-control">
                    <el-select v-model="part.type" size="small" placeholder="Select type">
                      <el-option label="Linux Filesystem" value="8300" />
                      <el-option label="Linux Swap" value="8200" />
                      <el-option label="EFI System" value="EF00" />
                      <el-option label="Windows Data" value="0700" />
                      <el-option label="Linux LVM" value="8E00" />
                      <el-option label="Linux RAID" value="FD00" />
                    </el-select>
                  </div>
                  <div class="size-info">
                    <span>{{ calculatePartitionSize(part) }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <el-button @click="addPartition" type="primary" text class="add-partition-btn" size="small">
              <Icon icon="mdi:plus" />
              Add Partition
            </el-button>
          </div>
        </el-form-item>
        
        <div class="warning-section">
          <el-alert type="error" :closable="false" size="small">
            <template #title>
              <strong>WARNING: DATA LOSS</strong>
            </template>
            All data on <strong>{{ partitionForm.device }}</strong> will be permanently deleted!
          </el-alert>
        </div>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="partitionDialogVisible = false" size="small">
            Cancel
          </el-button>
          <el-button 
            type="primary" 
            @click="createPartitions" 
            :loading="partitionLoading"
            :disabled="partitionForm.partitions.length === 0"
            size="small"
          >
            Create Partitions
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- RAID Dialog -->
    <el-dialog 
      v-model="raidDialogVisible" 
      title="Create RAID Array" 
      width="600px"
      class="storage-dialog"
    >
      <el-form :model="raidForm" label-position="top" size="small">
        <el-form-item label="RAID Level" required>
          <el-select v-model="raidForm.level" class="full-width" @change="updateRaidInfo">
            <el-option label="RAID 0 - Striping (Performance)" value="0" />
            <el-option label="RAID 1 - Mirroring (Redundancy)" value="1" />
            <el-option label="RAID 5 - Parity (Balance)" value="5" />
            <el-option label="RAID 6 - Double Parity (High Redundancy)" value="6" />
            <el-option label="RAID 10 - Mirror + Stripe (Best of Both)" value="10" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Devices" required>
          <el-select 
            v-model="raidForm.devices" 
            multiple 
            class="full-width"
            filterable
            collapse-tags
            collapse-tags-tooltip
          >
            <el-option
              v-for="device in raidEligibleDevices"
              :key="device.path"
              :label="`${device.path} (${device.model || 'Unknown'})`"
              :value="device.path"
              :disabled="isSystemDisk(device.path)"
            >
              <div class="device-select-option">
                <Icon :icon="getDeviceIcon(device.path)" width="16" />
                <span class="device-name">{{ device.path }}</span>
                <span class="device-meta">
                  {{ device.model || 'Unknown' }} • {{ formatBytes(device.size) }}
                </span>
              </div>
            </el-option>
          </el-select>
          <div class="selection-info">
            Selected: {{ raidForm.devices.length }} devices (min: {{ requiredDevicesForLevel }})
          </div>
        </el-form-item>
        
        <el-form-item label="RAID Name" required>
          <el-input v-model="raidForm.name" placeholder="md0">
            <template #prepend>/dev/md</template>
          </el-input>
        </el-form-item>
        
        <el-form-item 
          v-if="['0', '5', '6', '10'].includes(raidForm.level)"
          label="Chunk Size"
        >
          <el-select v-model="raidForm.chunkSize" class="full-width">
            <el-option label="64 KB" value="64" />
            <el-option label="128 KB" value="128" />
            <el-option label="256 KB" value="256" />
            <el-option label="512 KB" value="512" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Filesystem Type">
          <el-select v-model="raidForm.fsType" class="full-width">
            <el-option label="ext4" value="ext4" />
            <el-option label="xfs" value="xfs" />
            <el-option label="btrfs" value="btrfs" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Start RAID after creation">
          <el-switch v-model="raidForm.autoStart" />
        </el-form-item>
        
        <div class="raid-info-section">
          <div class="info-card">
            <div class="info-card-header">
              <Icon :icon="raidInfo.icon" width="18" />
              <span>{{ raidInfo.title }}</span>
            </div>
            <div class="info-card-content">
              <p>{{ raidInfo.description }}</p>
              <div class="raid-stats">
                <div class="raid-stat">
                  <span class="raid-stat-label">Capacity:</span>
                  <span class="raid-stat-value">{{ formatBytes(raidCapacity) }}</span>
                </div>
                <div class="raid-stat">
                  <span class="raid-stat-label">Devices:</span>
                  <span class="raid-stat-value">{{ raidForm.devices.length }}</span>
                </div>
                <div class="raid-stat">
                  <span class="raid-stat-label">Redundancy:</span>
                  <span class="raid-stat-value">{{ raidInfo.redundancy }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="warning-section">
          <el-alert type="error" :closable="false" size="small">
            <template #title>
              <strong>WARNING: DATA LOSS</strong>
            </template>
            All data on selected devices will be permanently deleted!
          </el-alert>
        </div>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="raidDialogVisible = false" size="small">
            Cancel
          </el-button>
          <el-button 
            type="primary" 
            @click="createRaid" 
            :loading="raidLoading"
            :disabled="raidForm.devices.length < requiredDevicesForLevel"
            size="small"
          >
            Create RAID
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- LVM Dialog -->
    <el-dialog 
      v-model="lvmDialogVisible" 
      title="Create LVM Volume" 
      width="600px"
      class="storage-dialog"
    >
      <el-form :model="lvmForm" label-position="top" size="small">
        <el-form-item label="Physical Volumes" required>
          <el-select 
            v-model="lvmForm.physicalVolumes" 
            multiple 
            class="full-width"
            filterable
            collapse-tags
            collapse-tags-tooltip
          >
            <el-option-group label="Disks">
              <el-option
                v-for="device in lvmEligibleDevices"
                :key="device.path"
                :label="`${device.path} (${device.model || 'Unknown'})`"
                :value="device.path"
              >
                <div class="device-select-option">
                  <Icon :icon="getDeviceIcon(device.path)" width="16" />
                  <span class="device-name">{{ device.path }}</span>
                  <span class="device-meta">
                    {{ device.model || 'Unknown' }} • {{ formatBytes(device.size) }}
                  </span>
                </div>
              </el-option>
            </el-option-group>
            
            <el-option-group label="Partitions">
              <el-option
                v-for="partition in lvmEligiblePartitions"
                :key="partition.path"
                :label="`${partition.path} (${partition.model || 'Unknown'})`"
                :value="partition.path"
              >
                <div class="device-select-option">
                  <Icon icon="mdi:harddisk-partition" width="16" />
                  <span class="device-name">{{ partition.path }}</span>
                  <span class="device-meta">
                    {{ partition.model || 'Unknown' }} • {{ formatBytes(partition.size) }}
                  </span>
                </div>
              </el-option>
            </el-option-group>
          </el-select>
          <div class="selection-info">
            Selected: {{ lvmForm.physicalVolumes.length }} devices
          </div>
        </el-form-item>
        
        <el-form-item label="Volume Group Name" required>
          <el-input v-model="lvmForm.volumeGroup" placeholder="vg_data" />
        </el-form-item>
        
        <el-form-item label="Logical Volume Name" required>
          <el-input v-model="lvmForm.logicalVolume" placeholder="lv_storage" />
        </el-form-item>
        
        <el-form-item label="Logical Volume Size">
          <div class="size-control">
            <el-input-number 
              v-model="lvmForm.size" 
              :min="1" 
              :max="lvmMaxSize"
              :step="lvmForm.unit === 'G' ? 10 : 100"
              :precision="0"
              size="small"
              style="width: 120px;"
            />
            <el-select 
              v-model="lvmForm.unit" 
              size="small"
              class="unit-select"
            >
              <el-option label="GB" value="G" />
              <el-option label="%" value="%" />
            </el-select>
          </div>
          <div class="size-info">
            <span>Available: {{ formatBytes(lvmTotalSize) }}</span>
            <span v-if="lvmForm.unit === '%'">({{ lvmForm.size }}% = {{ formatBytes((lvmTotalSize * lvmForm.size) / 100) }})</span>
          </div>
        </el-form-item>
        
        <el-form-item label="Filesystem Type">
          <el-select v-model="lvmForm.fsType" class="full-width">
            <el-option label="ext4" value="ext4" />
            <el-option label="xfs" value="xfs" />
            <el-option label="btrfs" value="btrfs" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Mount Path (optional)">
          <el-input v-model="lvmForm.mountPath" placeholder="/mnt/lvm_storage" />
        </el-form-item>
        
        <div class="lvm-info-section">
          <div class="info-card">
            <div class="info-card-header">
              <Icon icon="mdi:layers" width="18" />
              <span>LVM Information</span>
            </div>
            <div class="info-card-content">
              <p>LVM (Logical Volume Manager) allows you to combine multiple physical storage devices into a single logical volume.</p>
              <div class="lvm-stats">
                <div class="lvm-stat">
                  <span class="lvm-stat-label">Total Capacity:</span>
                  <span class="lvm-stat-value">{{ formatBytes(lvmTotalSize) }}</span>
                </div>
                <div class="lvm-stat">
                  <span class="lvm-stat-label">Selected Devices:</span>
                  <span class="lvm-stat-value">{{ lvmForm.physicalVolumes.length }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="warning-section">
          <el-alert type="error" :closable="false" size="small">
            <template #title>
              <strong>WARNING: DATA LOSS</strong>
            </template>
            All data on selected devices will be permanently deleted!
          </el-alert>
        </div>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="lvmDialogVisible = false" size="small">
            Cancel
          </el-button>
          <el-button 
            type="primary" 
            @click="createLvm" 
            :loading="lvmLoading"
            :disabled="lvmForm.physicalVolumes.length === 0 || !lvmForm.volumeGroup || !lvmForm.logicalVolume"
            size="small"
          >
            Create LVM
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- Fstab Editor Dialog -->
    <el-dialog 
      v-model="fstabDialogVisible" 
      title="/etc/fstab Editor" 
      width="800px"
      class="storage-dialog code-dialog"
    >
      <div class="fstab-editor-container">
        <el-alert type="warning" :closable="false" style="margin-bottom: 15px;" size="small">
          <template #title>
            <strong>Warning</strong>
          </template>
          Incorrect modifications may prevent your system from booting properly. Edit with caution!
        </el-alert>
        
        <div class="editor-toolbar">
          <el-button-group size="small">
            <el-button @click="fetchFstabContent" :loading="fstabLoading">
              <Icon icon="mdi:reload" />
              Reload
            </el-button>
            <el-button @click="insertFstabTemplate">
              <Icon icon="mdi:format-align-left" />
              Insert Template
            </el-button>
            <el-button @click="validateFstab" :loading="fstabLoading">
              <Icon icon="mdi:check-circle" />
              Validate
            </el-button>
          </el-button-group>
          <div class="editor-info">
            <span class="line-count">{{ fstabLines }} lines</span>
          </div>
        </div>
        
        <el-input
          v-model="fstabContent"
          type="textarea"
          :rows="20"
          resize="none"
          placeholder="Loading fstab content..."
          :loading="fstabLoading"
          class="code-editor"
          spellcheck="false"
        />
        
        <div class="editor-actions">
          <el-button @click="fstabDialogVisible = false" size="small">
            Cancel
          </el-button>
          <el-button type="primary" @click="saveFstab" :loading="fstabLoading" size="small">
            <Icon icon="mdi:content-save" />
            Save Changes
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- Debug Dialog -->
    <el-dialog 
      v-model="debugDialogVisible" 
      title="Device Debug Information" 
      width="90%"
      :fullscreen="isMobile"
      class="storage-dialog debug-dialog"
    >
      <el-tabs type="border-card">
        <el-tab-pane label="All Devices">
          <div class="tab-content">
            <div class="tab-header">
              <h4>All Detected Devices</h4>
              <el-tag :type="debugData.allDevices.length > 0 ? 'success' : 'info'">
                {{ debugData.allDevices.length }} devices
              </el-tag>
            </div>
            <el-table 
              :data="debugData.allDevices" 
              stripe 
              border
              height="400"
              size="small"
              class="debug-table"
            >
              <el-table-column prop="path" label="Path" width="150" fixed>
                <template #default="{ row }">
                  <div class="device-path-cell">
                    <Icon :icon="getDeviceIcon(row.path)" width="14" />
                    <span>{{ row.path }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="model" label="Model" width="120" />
              <el-table-column prop="type" label="Type" width="80">
                <template #default="{ row }">
                  <el-tag size="small" :type="getDeviceTagType(row.type)">
                    {{ row.type }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="fstype" label="Filesystem" width="100">
                <template #default="{ row }">
                  <el-tag v-if="row.fstype" size="small" :type="getFsTagType(row.fstype)" effect="plain">
                    {{ row.fstype }}
                  </el-tag>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="mountpoint" label="Mount Point" width="200" show-overflow-tooltip />
              <el-table-column prop="size" label="Size" width="100" sortable>
                <template #default="{ row }">
                  {{ formatBytes(row.size) }}
                </template>
              </el-table-column>
              <el-table-column label="Status" width="100" fixed="right">
                <template #default="{ row }">
                  <el-tag 
                    :type="isOverlayDevice(row) ? 'danger' : 'success'"
                    size="small"
                    :effect="isOverlayDevice(row) ? 'dark' : 'light'"
                  >
                    {{ isOverlayDevice(row) ? 'OVERLAY' : 'NORMAL' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane label="RAID Arrays">
          <div class="tab-content">
            <div class="tab-header">
              <h4>RAID Arrays</h4>
              <el-tag type="warning">
                {{ debugData.raidDevices.length }} arrays
              </el-tag>
            </div>
            <el-table 
              :data="debugData.raidDevices" 
              stripe 
              border
              height="400"
              size="small"
              class="debug-table"
            >
              <el-table-column prop="device" label="Device" width="150">
                <template #default="{ row }">
                  <div class="device-path-cell">
                    <Icon icon="mdi:raid" width="14" />
                    <span>{{ row.device }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="level" label="RAID Level" width="100">
                <template #default="{ row }">
                  <el-tag type="warning" size="small">RAID {{ row.level }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="devices" label="Devices" width="200">
                <template #default="{ row }">
                  <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                    <el-tag v-for="dev in row.devices" :key="dev" size="mini" type="info">
                      {{ dev }}
                    </el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="size" label="Size" width="100">
                <template #default="{ row }">
                  {{ formatBytes(row.size) }}
                </template>
              </el-table-column>
              <el-table-column prop="state" label="State" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.state === 'active' ? 'success' : 'danger'" size="small">
                    {{ row.state }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane label="LVM Volumes">
          <div class="tab-content">
            <div class="tab-header">
              <h4>LVM Volumes</h4>
              <el-tag type="success">
                {{ debugData.lvmVolumes.length }} volumes
              </el-tag>
            </div>
            <el-table 
              :data="debugData.lvmVolumes" 
              stripe 
              border
              height="400"
              size="small"
              class="debug-table"
            >
              <el-table-column prop="path" label="Path" width="150">
                <template #default="{ row }">
                  <div class="device-path-cell">
                    <Icon icon="mdi:layers" width="14" />
                    <span>{{ row.path }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="volumeGroup" label="Volume Group" width="150" />
              <el-table-column prop="logicalVolume" label="Logical Volume" width="150" />
              <el-table-column prop="size" label="Size" width="100">
                <template #default="{ row }">
                  {{ formatBytes(row.size) }}
                </template>
              </el-table-column>
              <el-table-column prop="fstype" label="Filesystem" width="100">
                <template #default="{ row }">
                  <el-tag v-if="row.fstype" size="small" :type="getFsTagType(row.fstype)" effect="plain">
                    {{ row.fstype }}
                  </el-tag>
                  <span v-else>-</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <div class="debug-footer">
          <div class="debug-actions">
            <el-button @click="debugDialogVisible = false" size="small">
              Close
            </el-button>
            <el-button type="primary" @click="copyDebugData" size="small">
              <Icon icon="mdi:content-copy" />
              Copy JSON
            </el-button>
            <el-button type="warning" @click="exportDebugData" size="small">
              <Icon icon="mdi:download" />
              Export File
            </el-button>
          </div>
          <div class="debug-info">
            <span class="debug-timestamp">
              Generated: {{ new Date().toLocaleString() }}
            </span>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- Device Details Dialog -->
    <el-dialog 
      v-model="detailsDialogVisible" 
      :title="`Device Details: ${selectedFs?.device}`" 
      width="700px"
      class="storage-dialog details-dialog"
    >
      <div v-if="selectedFs" class="device-details">
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">Device:</span>
            <span class="detail-value">{{ selectedFs.device }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Type:</span>
            <span class="detail-value">{{ selectedFs.type.toUpperCase() }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Size:</span>
            <span class="detail-value">{{ formatBytes(selectedFs.size) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Used:</span>
            <span class="detail-value">{{ formatBytes(selectedFs.used) }} ({{ selectedFs.usedPercent }}%)</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Free:</span>
            <span class="detail-value">{{ formatBytes(selectedFs.size - selectedFs.used) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Mount Point:</span>
            <span class="detail-value">{{ selectedFs.mounted || 'Not mounted' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Status:</span>
            <span class="detail-value">{{ selectedFs.status }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Read Only:</span>
            <span class="detail-value">{{ selectedFs.readOnly ? 'Yes' : 'No' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Auto-mount:</span>
            <span class="detail-value">{{ selectedFs.inFstab ? 'Yes' : 'No' }}</span>
          </div>
        </div>
        
        <div v-if="selectedFs.inFstab" class="fstab-info">
          <h4>Fstab Entry</h4>
          <pre>{{ getFstabEntry(selectedFs) }}</pre>
        </div>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="detailsDialogVisible = false" size="small">
            Close
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'StorageFilesystemsWidget',
  displayName: 'Filesystems'
}
</script>

<script setup>
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage, ElNotification, ElMessageBox } from 'element-plus'
import { useTheme } from '@/composables/useTheme.js'

const { t } = useI18n()
const { isDarkMode, toggleTheme } = useTheme()

const abortController = ref(new AbortController())

const api = axios.create({
  baseURL: `${window.location.protocol}//${window.location.hostname}:1112`,
  signal: abortController.value.signal
})

// Reactive state
const filesystems = ref([])
const allDevices = ref([])
const raidDevices = ref([])
const lvmVolumes = ref([])
const loading = ref(false)
const error = ref(null)
const sortBy = ref('device')
const sortOrder = ref('asc')

// Dialog states
const mountDialogVisible = ref(false)
const mountLoading = ref(false)
const formatDialogVisible = ref(false)
const formatLoading = ref(false)
const partitionDialogVisible = ref(false)
const partitionLoading = ref(false)
const raidDialogVisible = ref(false)
const raidLoading = ref(false)
const lvmDialogVisible = ref(false)
const lvmLoading = ref(false)
const fstabDialogVisible = ref(false)
const fstabLoading = ref(false)
const detailsDialogVisible = ref(false)
const debugDialogVisible = ref(false)
const fstabContent = ref('')
const fstabEntries = ref([])

// Form models
const mountForm = ref({
  device: '',
  mountPoint: '',
  fsType: 'auto',
  options: 'defaults,nofail',
  zfsPoolName: '',
  lvmVolumeGroup: '',
  raidStart: true
})

const formatForm = ref({
  device: '',
  fsType: 'ext4',
  label: '',
  zfsPoolName: 'mypool',
  force: false
})

const partitionForm = ref({
  device: '',
  scheme: 'gpt',
  partitions: [{ size: 100, unit: '%', type: '8300' }]
})

const raidForm = ref({
  level: '1',
  devices: [],
  name: 'md0',
  chunkSize: '128',
  fsType: 'ext4',
  autoStart: true
})

const lvmForm = ref({
  physicalVolumes: [],
  volumeGroup: 'vg_data',
  logicalVolume: 'lv_storage',
  size: 100,
  unit: '%',
  fsType: 'ext4',
  mountPath: '/mnt/lvm_storage'
})

// UI State
const currentPage = ref(1)
const pageSize = ref(9)
const viewFilter = ref('all')
const searchQuery = ref('')
const typeFilter = ref('')
const statusFilter = ref('')
const selectedFs = ref(null)
const selectedDeviceInfo = ref(null)

// Disk size for partition dialog
const totalDiskSize = ref(0)
const usedDiskSpace = ref(0)
const diskUsagePercentage = ref(0)

// Debug data
const debugData = ref({
  allDevices: [],
  raidDevices: [],
  lvmVolumes: [],
  filteredDevices: [],
  overlayDevices: []
})

// Computed properties
const supportedFilesystems = ref([
  'bcachefs', 'btrfs', 'ext4', 'f2fs', 'jfs', 'xfs', 'zfs', 'ntfs', 'vfat', 'exfat'
])

const getThemeIcon = computed(() => {
  return isDarkMode.value ? 'mdi:weather-night' : 'mdi:weather-sunny'
})

const darkMode = computed({
  get: () => isDarkMode.value,
  set: (val) => {
    if (val !== isDarkMode.value) {
      toggleTheme()
    }
  }
})

const isMobile = computed(() => window.innerWidth < 768)

const totalUsedPercent = computed(() => {
  if (filesystems.value.length === 0) return 0
  const total = filesystems.value.reduce((sum, fs) => sum + (fs.usedPercent || 0), 0)
  return Math.round(total / filesystems.value.length)
})

const totalCapacity = computed(() => {
  return filesystems.value.reduce((sum, fs) => sum + (fs.size || 0), 0)
})

const autoMountCount = computed(() => {
  return filesystems.value.filter(fs => fs.inFstab).length
})

const fstabLines = computed(() => {
  return fstabContent.value.split('\n').length
})

const allAvailableDevices = computed(() => {
  return filterSystemDevices(allDevices.value.filter(device => 
    device.type === 'disk' && 
    !device.path.includes('loop') &&
    !isRaidMember(device)
  ))
})

const allAvailablePartitions = computed(() => {
  return allDevices.value.flatMap(device => 
    (device.children || []).map(part => ({
      ...part,
      model: device.model || 'Unknown',
      size: part.size ? parseInt(part.size) : 0
    }))
  ).filter(part => 
    !part.path.includes('loop') &&
    !isRaidMember(part) &&
    !isLvmMember(part)
  )
})

const mountableDevices = computed(() => {
  const mountedPaths = filesystems.value.map(fs => fs.device)
  
  const devices = allDevices.value.filter(device => 
    !mountedPaths.includes(device.path) && 
    device.type === 'disk' &&
    !isRaidMember(device)
  )
  
  const partitions = allDevices.value.flatMap(device => 
    (device.children || [])
      .filter(part => !mountedPaths.includes(part.path))
      .map(part => ({
        ...part,
        model: device.model || 'Unknown'
      }))
  )

  const raids = raidDevices.value.filter(raid => 
    !mountedPaths.includes(raid.device)
  ).map(raid => ({
    path: raid.device,
    model: 'RAID Array',
    size: raid.size,
    fstype: raid.fstype || '',
    label: raid.name,
    isRaid: true
  }))

  const lvms = lvmVolumes.value.filter(lvm => 
    !mountedPaths.includes(lvm.path)
  ).map(lvm => ({
    path: lvm.path,
    model: 'LVM Volume',
    size: lvm.size,
    fstype: lvm.fstype || '',
    label: lvm.logicalVolume,
    isLvm: true
  }))

  return filterSystemDevices([...devices, ...partitions, ...raids, ...lvms])
})

const partitionableDevices = computed(() => {
  return allDevices.value.filter(device => 
    (device.type === 'disk' || device.path.includes('/dev/md')) && 
    !device.path.includes('loop') &&
    !isSystemDisk(device.path) &&
    !isRaidMember(device)
  )
})

const raidEligibleDevices = computed(() => {
  return allDevices.value.filter(device => 
    device.type === 'disk' && 
    !device.path.includes('loop') &&
    !isSystemDisk(device.path) &&
    !device.path.includes('md') &&
    !device.model?.includes('RAID') &&
    !isLvmMember(device)
  )
})

const lvmEligibleDevices = computed(() => {
  return allDevices.value.filter(device => 
    device.type === 'disk' && 
    !device.path.includes('loop') &&
    !isSystemDisk(device.path) &&
    !device.path.includes('md') &&
    !isRaidMember(device)
  )
})

const lvmEligiblePartitions = computed(() => {
  return allDevices.value.flatMap(device => 
    (device.children || []).filter(part => 
      part.type === 'part' &&
      !isRaidMember(part) &&
      !isLvmMember(part)
    ).map(part => ({
      ...part,
      model: device.model || 'Unknown'
    }))
  )
})

const raidCapacity = computed(() => {
  if (raidForm.value.devices.length === 0) return 0
  
  const device = allDevices.value.find(d => d.path === raidForm.value.devices[0])
  if (!device) return 0
  
  const totalSize = device.size * raidForm.value.devices.length
  
  switch (raidForm.value.level) {
    case '0': return totalSize
    case '1': return device.size
    case '5': return totalSize - device.size
    case '6': return totalSize - (2 * device.size)
    case '10': return totalSize / 2
    default: return 0
  }
})

const lvmTotalSize = computed(() => {
  return lvmForm.value.physicalVolumes.reduce((total, devicePath) => {
    const device = [...allDevices.value, ...allAvailablePartitions.value].find(d => d.path === devicePath)
    return total + (device?.size || 0)
  }, 0)
})

const lvmMaxSize = computed(() => {
  if (lvmForm.value.unit === '%') return 100
  return Math.floor(lvmTotalSize.value / (1024 * 1024 * 1024))
})

const requiredDevicesForLevel = computed(() => {
  switch (raidForm.value.level) {
    case '0': return 2
    case '1': return 2
    case '5': return 3
    case '6': return 4
    case '10': return 4
    default: return 2
  }
})

const raidInfo = computed(() => {
  const info = {
    '0': {
      title: 'RAID 0 - Striping',
      description: 'Data is split across all drives for maximum performance. No redundancy - failure of any drive results in total data loss.',
      icon: 'mdi:speedometer',
      redundancy: 'None'
    },
    '1': {
      title: 'RAID 1 - Mirroring',
      description: 'Data is duplicated on all drives. Provides redundancy but reduces available capacity.',
      icon: 'mdi:mirror',
      redundancy: 'Full'
    },
    '5': {
      title: 'RAID 5 - Parity',
      description: 'Data and parity information are distributed across drives. Requires at least 3 drives.',
      icon: 'mdi:shield-check',
      redundancy: 'Single drive'
    },
    '6': {
      title: 'RAID 6 - Double Parity',
      description: 'Similar to RAID 5 with double parity. Can survive two drive failures. Requires at least 4 drives.',
      icon: 'mdi:shield-check-outline',
      redundancy: 'Two drives'
    },
    '10': {
      title: 'RAID 10 - Mirror + Stripe',
      description: 'Combines mirroring and striping. Requires an even number of drives (minimum 4).',
      icon: 'mdi:layers',
      redundancy: 'Multiple drives'
    }
  }
  
  return info[raidForm.value.level] || info['1']
})

const filteredFilesystems = computed(() => {
  let result = [...filesystems.value]
  
  if (viewFilter.value === 'raid') {
    result = result.filter(fs => isRaidDevice(fs.device))
  } else if (viewFilter.value === 'lvm') {
    result = result.filter(fs => isLvmDevice(fs.device))
  } else if (viewFilter.value === 'critical') {
    result = result.filter(fs => fs.usedPercent > 90)
  }
  
  if (typeFilter.value) {
    result = result.filter(fs => fs.type === typeFilter.value)
  }
  
  if (statusFilter.value) {
    result = result.filter(fs => fs.status === statusFilter.value)
  }
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(fs => 
      fs.device.toLowerCase().includes(query) ||
      (fs.mounted && fs.mounted.toLowerCase().includes(query)) ||
      fs.type.toLowerCase().includes(query)
    )
  }
  
  // Sorting
  result.sort((a, b) => {
    const aValue = a[sortBy.value]
    const bValue = b[sortBy.value]
    
    if (typeof aValue === 'string') {
      return sortOrder.value === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    } else {
      return sortOrder.value === 'asc'
        ? aValue - bValue
        : bValue - aValue
    }
  })
  
  return result
})

const paginatedFilesystems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredFilesystems.value.slice(start, end)
})

const emptyMessage = computed(() => {
  if (viewFilter.value !== 'all' || searchQuery.value || typeFilter.value || statusFilter.value) {
    return 'No filesystems match the current filters'
  }
  return 'No mounted filesystems detected. Mount a device to get started.'
})

// Helper methods
const formatBytes = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

const truncatePath = (path, maxLength) => {
  if (!path || path.length <= maxLength) return path
  return '...' + path.slice(-maxLength + 3)
}

const getDeviceShortName = (path) => {
  return path.split('/').pop()
}

const getDeviceLabel = (device) => {
  let label = `${device.path}`
  if (device.model && device.model !== 'Unknown') {
    label += ` (${device.model})`
  }
  if (device.fstype) {
    label += ` [${device.fstype.toUpperCase()}]`
  }
  return label
}

const getDeviceTagType = (device) => {
  if (device.includes('nvme')) return 'primary'
  if (device.includes('md') || isRaidDevice(device)) return 'warning'
  if (device.includes('mapper') || isLvmDevice(device)) return 'success'
  if (device.includes('zfs')) return 'info'
  return ''
}

const isRaidDevice = (device) => {
  return device.includes('/dev/md') || device.includes('raid') || 
         raidDevices.value.some(raid => raid.device === device)
}

const isLvmDevice = (device) => {
  return device.includes('/dev/mapper') || device.includes('/dev/dm-') ||
         lvmVolumes.value.some(lvm => lvm.path === device)
}

const isRaidMember = (device) => {
  return raidDevices.value.some(raid => 
    raid.devices?.includes(device.path)
  )
}

const isLvmMember = (device) => {
  return device.fstype === 'LVM2_member' || device.fstype === 'LVM'
}

const getFsTagType = (type) => {
  const types = {
    ext4: 'success',
    xfs: 'primary',
    zfs: 'warning',
    btrfs: 'info',
    ntfs: '',
    vfat: '',
    exfat: '',
    lvm2_member: 'success',
    lvm: 'success'
  }
  return types[type?.toLowerCase()] || ''
}

const getDeviceIcon = (device) => {
  if (device?.includes('nvme')) return 'mdi:memory'
  if (device?.includes('sd')) return 'mdi:harddisk'
  if (device?.includes('md') || isRaidDevice(device)) return 'mdi:raid'
  if (device?.includes('mapper') || isLvmDevice(device)) return 'mdi:layers'
  if (device?.includes('zfs')) return 'mdi:database'
  return 'mdi:harddisk'
}

const getFsIcon = (type) => {
  const icons = {
    ext4: 'mdi:linux',
    xfs: 'mdi:file-tree',
    ntfs: 'mdi:microsoft-windows',
    fat: 'mdi:usb-flash-drive',
    vfat: 'mdi:usb-flash-drive',
    exfat: 'mdi:usb-flash-drive',
    zfs: 'mdi:database',
    btrfs: 'mdi:database',
    bcachefs: 'mdi:database',
    f2fs: 'mdi:flash',
    jfs: 'mdi:file-tree',
    lvm2_member: 'mdi:layers',
    lvm: 'mdi:layers'
  }
  return icons[type?.toLowerCase()] || 'mdi:file-question'
}

const getFsColor = (type) => {
  const colors = {
    ext4: '#67c23a',
    xfs: '#409eff',
    zfs: '#e6a23c',
    btrfs: '#f56c6c',
    ntfs: '#909399',
    vfat: '#909399'
  }
  return colors[type?.toLowerCase()] || '#909399'
}

const getStatusIcon = (status) => {
  const icons = {
    active: 'mdi:check-circle',
    inactive: 'mdi:close-circle',
    readonly: 'mdi:lock',
    error: 'mdi:alert-circle',
    unknown: 'mdi:help-circle'
  }
  return icons[status?.toLowerCase()] || 'mdi:help-circle'
}

const getStatusType = (status) => {
  const types = {
    active: 'success',
    inactive: 'info',
    readonly: 'warning',
    error: 'danger',
    unknown: ''
  }
  return types[status?.toLowerCase()] || ''
}

const getUsageColor = (percent) => {
  if (percent > 90) return '#f56c6c'
  if (percent > 70) return '#e6a23c'
  return '#67c23a'
}

const isSystemDisk = (devicePath) => {
  const systemDiskPatterns = ['/dev/sda', '/dev/nvme0n1', '/dev/mmcblk0']
  return systemDiskPatterns.some(pattern => devicePath.startsWith(pattern))
}

const isOverlayDevice = (device) => {
  const devicePath = device.path.toLowerCase()
  const deviceModel = (device.model || '').toLowerCase()
  const deviceMount = (device.mountpoint || '').toLowerCase()
  const deviceFsType = (device.fstype || '').toLowerCase()

  const overlayPatterns = ['overlay', 'docker', 'containerd', 'podman']
  return overlayPatterns.some(pattern => 
    devicePath.includes(pattern) ||
    deviceModel.includes(pattern) ||
    deviceMount.includes(pattern) ||
    deviceFsType.includes(pattern)
  )
}

const getOverlayReason = (device) => {
  const reasons = []
  const devicePath = device.path.toLowerCase()
  const deviceModel = (device.model || '').toLowerCase()
  const deviceMount = (device.mountpoint || '').toLowerCase()
  const deviceFsType = (device.fstype || '').toLowerCase()

  if (devicePath.includes('overlay')) reasons.push('overlay path')
  if (devicePath.includes('docker')) reasons.push('docker path')
  if (deviceModel.includes('overlay')) reasons.push('overlay model')
  if (deviceMount.includes('docker')) reasons.push('docker mount')
  if (deviceFsType.includes('overlay')) reasons.push('overlay fs')

  return reasons.length > 0 ? reasons.join(', ') : 'container/virtual'
}

const filterSystemDevices = (devices) => {
  const overlayPatterns = ['overlay', 'docker', 'containerd', 'podman']

  return devices.filter(device => {
    const devicePath = device.path.toLowerCase()
    const deviceModel = (device.model || '').toLowerCase()
    const deviceMount = (device.mountpoint || '').toLowerCase()
    const deviceFsType = (device.fstype || '').toLowerCase()

    const isOverlay = overlayPatterns.some(pattern => 
      devicePath.includes(pattern) ||
      deviceModel.includes(pattern) ||
      deviceMount.includes(pattern) ||
      deviceFsType.includes(pattern)
    )

    return !isOverlay
  })
}

const getDefaultMountPoint = () => {
  const device = selectedDeviceInfo.value
  if (!device) return '/mnt/new_disk'
  
  let baseName = device.path.split('/').pop()
  if (device.label) {
    baseName = device.label.toLowerCase().replace(/[^a-z0-9]/g, '_')
  }
  
  return `/mnt/${baseName}`
}

const getLvmVolumeGroup = (path) => {
  const match = path.match(/\/dev\/mapper\/(.+)-(.+)/)
  return match ? match[1] : 'unknown'
}

const getFstabEntry = (fs) => {
  return `${fs.device} ${fs.mounted} ${fs.type} defaults,nofail 0 0`
}

// Partition methods
const addPartition = () => {
  partitionForm.value.partitions.push({ size: 10, unit: 'G', type: '8300' })
}

const removePartition = (index) => {
  partitionForm.value.partitions.splice(index, 1)
}

const calculatePartitionSize = (part) => {
  if (part.unit === '%') {
    const size = (part.size / 100) * totalDiskSize.value
    return formatBytes(size)
  } else if (part.unit === 'G') {
    return `${part.size} GB`
  } else {
    return `${part.size} MB`
  }
}

const getMaxSize = (part) => {
  if (part.unit === '%') return 100
  if (part.unit === 'G') return Math.floor(totalDiskSize.value / (1024 * 1024 * 1024))
  return Math.floor(totalDiskSize.value / (1024 * 1024))
}

const changePartitionUnit = (part, newUnit) => {
  const oldUnit = part.unit
  part.unit = newUnit
  
  if (oldUnit === '%' && newUnit !== '%') {
    const sizeInBytes = (part.size / 100) * totalDiskSize.value
    if (newUnit === 'G') {
      part.size = Math.floor(sizeInBytes / (1024 * 1024 * 1024))
    } else {
      part.size = Math.floor(sizeInBytes / (1024 * 1024))
    }
  } else if (oldUnit !== '%' && newUnit === '%') {
    const sizeInBytes = oldUnit === 'G' 
      ? part.size * 1024 * 1024 * 1024 
      : part.size * 1024 * 1024
    part.size = Math.floor((sizeInBytes / totalDiskSize.value) * 100)
  }
  
  const maxSize = getMaxSizeForUnit(newUnit)
  if (part.size > maxSize) {
    part.size = maxSize
  }
}

const getMaxSizeForUnit = (unit) => {
  if (!totalDiskSize.value) return 100
  if (unit === '%') return 100
  if (unit === 'G') return Math.floor(totalDiskSize.value / (1024 * 1024 * 1024))
  return Math.floor(totalDiskSize.value / (1024 * 1024))
}

const checkSystemDisk = (devicePath) => {
  if (isSystemDisk(devicePath)) {
    ElMessage.warning('This appears to be a system disk. Partitioning system disks is not recommended.')
  }
}

const updateRaidInfo = () => {
  // Method triggered when RAID level changes
}

const toggleSelection = (fs) => {
  if (selectedFs.value && selectedFs.value.device === fs.device) {
    selectedFs.value = null
  } else {
    selectedFs.value = fs
  }
}

// API methods
const fetchDevices = async () => {
  try {
    const response = await axios.get('/api/storage/devices')
    allDevices.value = response.data.data || []
    
    // Fetch RAID devices
    try {
      const raidResponse = await axios.get('/api/storage/raid')
      raidDevices.value = raidResponse.data.data || []
    } catch (raidError) {
      console.warn('Error fetching RAID devices:', raidError)
    }
    
    // Fetch LVM volumes
    try {
      const lvmResponse = await axios.get('/api/storage/lvm')
      lvmVolumes.value = lvmResponse.data.data || []
    } catch (lvmError) {
      console.warn('Error fetching LVM volumes:', lvmError)
    }
  } catch (err) {
    console.error('Error fetching devices:', err)
    throw err
  }
}

const refreshFilesystems = async () => {
  abortController.value.abort()
  abortController.value = new AbortController()
  api.defaults.signal = abortController.value.signal

  try {
    loading.value = true
    error.value = null
    
    const [fsResponse, fstabResponse] = await Promise.all([
      api.get('/api/storage/filesystems'),
      api.get('/api/storage/fstab-check')
    ])
    
    if (Array.isArray(fsResponse.data?.data)) {
      filesystems.value = fsResponse.data.data.map(fs => ({
        ...fs,
        inFstab: isAutoMounted(fs.device, fs.mounted),
        fstabLoading: false,
        usedPercent: fs.usedPercent || Math.round((fs.used / fs.size) * 100)
      }))
    }
    
    fstabEntries.value = fstabResponse.data.entries || []
    
  } catch (error) {
    if (!axios.isCancel(error)) {
      error.value = 'Error loading filesystems'
      console.error('Error fetching filesystems:', error)
    }
  } finally {
    loading.value = false
  }
}

const isAutoMounted = (device, mountPoint) => {
  return fstabEntries.value.some(entry => 
    entry.device === device || entry.mountPoint === mountPoint
  )
}

const showMountDialog = async () => {
  try {
    loading.value = true
    await fetchDevices()
    mountDialogVisible.value = true
    mountForm.value = {
      device: '',
      mountPoint: '',
      fsType: 'auto',
      options: 'defaults,nofail',
      zfsPoolName: '',
      lvmVolumeGroup: '',
      raidStart: true
    }
    selectedDeviceInfo.value = null
  } catch (err) {
    error.value = 'Error loading devices'
    console.error('Error loading devices:', err)
  } finally {
    loading.value = false
  }
}

const onDeviceSelected = async (devicePath) => {
  const device = mountableDevices.value.find(d => d.path === devicePath)
  if (!device) return

  selectedDeviceInfo.value = {
    path: device.path,
    fsType: device.fstype,
    size: device.size,
    label: device.label,
    isRaid: device.isRaid || device.path.includes('/dev/md'),
    isLvm: device.isLvm || device.path.includes('/dev/mapper'),
    isZfs: device.fstype === 'zfs' || device.path.includes('zfs')
  }

  if (!selectedDeviceInfo.value.isZfs && !selectedDeviceInfo.value.isLvm) {
    mountForm.value.mountPoint = getDefaultMountPoint()
  }

  if (selectedDeviceInfo.value.fsType) {
    mountForm.value.fsType = selectedDeviceInfo.value.fsType
  } else if (selectedDeviceInfo.value.isZfs) {
    mountForm.value.fsType = 'zfs'
  } else if (selectedDeviceInfo.value.isLvm) {
    mountForm.value.fsType = 'auto'
  }
}

const mountDevice = async () => {
  try {
    mountLoading.value = true
    error.value = null
    
    if (!mountForm.value.device) {
      throw new Error('Please select a device')
    }
    
    // Special handling for RAID arrays
    if (isRaidDevice(mountForm.value.device)) {
      // Ensure RAID array is started
      if (mountForm.value.raidStart) {
        try {
          await axios.post('/api/storage/raid/start', { device: mountForm.value.device })
        } catch (raidError) {
          console.warn('Could not start RAID array:', raidError)
        }
      }
    }
    
    const mountData = {
      device: mountForm.value.device,
      mountPoint: mountForm.value.mountPoint,
      fsType: mountForm.value.fsType,
      options: mountForm.value.options,
      zfsPoolName: mountForm.value.zfsPoolName
    }
    
    const response = await axios.post('/api/storage/mount', mountData)

    if (response.data.success) {
      ElNotification({
        title: 'Success',
        message: 'Device mounted successfully',
        type: 'success'
      })
      mountDialogVisible.value = false
      await refreshFilesystems()
    }
  } catch (err) {
    error.value = err.response?.data?.details || err.message
    
    // Special error handling for RAID/LVM
    if (error.value.includes('RAID') || error.value.includes('mdadm')) {
      error.value += '. Try starting the RAID array first using the RAID management tools.'
    } else if (error.value.includes('LVM') || error.value.includes('mapper')) {
      error.value += '. Try activating the LVM volume first using the LVM management tools.'
    }
    
    ElNotification({
      title: 'Mount Error',
      message: error.value,
      type: 'error',
      duration: 5000
    })
  } finally {
    mountLoading.value = false
  }
}

const showFormatDialog = async () => {
  try {
    loading.value = true
    await fetchDevices()
    formatDialogVisible.value = true
    formatForm.value = {
      device: '',
      fsType: 'ext4',
      label: '',
      zfsPoolName: 'mypool',
      force: false
    }
  } catch (err) {
    error.value = 'Error loading devices'
    console.error('Error loading devices:', err)
  } finally {
    loading.value = false
  }
}

const formatDevice = async () => {
  try {
    formatLoading.value = true

    if (!formatForm.value.device) {
      throw new Error('Please select a device')
    }

    if (formatForm.value.fsType === 'zfs') {
      await ElMessageBox.confirm(
        `ZFS requires using the entire disk. All data on ${formatForm.value.device} will be permanently deleted. Continue?`,
        'Confirm ZFS Creation',
        {
          confirmButtonText: 'Create ZFS',
          cancelButtonText: 'Cancel',
          type: 'error',
          dangerouslyUseHTMLString: true
        }
      )
    } else {
      await ElMessageBox.confirm(
        `All data on ${formatForm.value.device} will be permanently deleted. Continue?`,
        'Confirm Format',
        {
          confirmButtonText: 'Format',
          cancelButtonText: 'Cancel',
          type: 'warning'
        }
      )
    }

    const response = await axios.post('/api/storage/format', {
      device: formatForm.value.device,
      fsType: formatForm.value.fsType,
      label: formatForm.value.zfsPoolName || formatForm.value.label,
      force: formatForm.value.force
    })

    ElNotification.success({
      title: 'Success',
      message: `Created ${formatForm.value.fsType.toUpperCase()} on ${response.data.deviceUsed || formatForm.value.device}`,
      duration: 5000
    })

    formatDialogVisible.value = false
    await refreshFilesystems()

  } catch (error) {
    if (error === 'cancel') return
    
    const message = error.response?.data?.details || error.message
    ElNotification.error({
      title: 'Format Error',
      message: message,
      duration: 0
    })
  } finally {
    formatLoading.value = false
  }
}

const showPartitionDialog = async () => {
  try {
    loading.value = true
    await fetchDevices()
    partitionDialogVisible.value = true
    partitionForm.value = {
      device: '',
      scheme: 'gpt',
      partitions: [{ size: 100, unit: '%', type: '8300' }]
    }
  } catch (err) {
    error.value = 'Error loading devices'
    console.error('Error loading devices:', err)
  } finally {
    loading.value = false
  }
}

const createPartitions = async () => {
  try {
    partitionLoading.value = true
    
    if (isSystemDisk(partitionForm.value.device)) {
      throw new Error('Cannot partition system disk')
    }

    await ElMessageBox.confirm(
      `You are about to partition ${partitionForm.value.device}. All existing data will be lost. Continue?`,
      'Confirm Partition',
      {
        confirmButtonText: 'Continue',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    )
    
    const partitions = partitionForm.value.partitions.map(part => ({
      size: part.unit === '%' ? `${part.size}%` : `${part.size}${part.unit}`,
      type: part.type
    }))
    
    const response = await axios.post('/api/storage/partition', {
      device: partitionForm.value.device,
      scheme: partitionForm.value.scheme,
      partitions: partitions
    })
    
    if (response.data.success) {
      ElNotification.success({
        title: 'Success',
        message: 'Partitions created successfully',
      })
      
      partitionDialogVisible.value = false
      await fetchDevices()
      await refreshFilesystems()
    }
    
  } catch (error) {
    if (error === 'cancel') return
    
    const message = error.response?.data?.details || error.message
    ElNotification.error({
      title: 'Error',
      message: message,
    })
  } finally {
    partitionLoading.value = false
  }
}

const showRaidDialog = async () => {
  try {
    loading.value = true
    await fetchDevices()
    raidDialogVisible.value = true
    raidForm.value = {
      level: '1',
      devices: [],
      name: 'md0',
      chunkSize: '128',
      fsType: 'ext4',
      autoStart: true
    }
  } catch (err) {
    error.value = 'Error loading devices'
    console.error('Error loading devices:', err)
  } finally {
    loading.value = false
  }
}

const createRaid = async () => {
  try {
    raidLoading.value = true
    
    if (raidForm.value.devices.length < requiredDevicesForLevel.value) {
      throw new Error(`RAID ${raidForm.value.level} requires at least ${requiredDevicesForLevel.value} devices`)
    }
    
    await ElMessageBox.confirm(
      `Creating RAID ${raidForm.value.level} with ${raidForm.value.devices.length} devices. All data will be lost. Continue?`,
      'Confirm RAID Creation',
      {
        confirmButtonText: 'Create RAID',
        cancelButtonText: 'Cancel',
        type: 'error',
        dangerouslyUseHTMLString: true
      }
    )
    
    const response = await axios.post('/api/storage/raid/create', {
      level: raidForm.value.level,
      devices: raidForm.value.devices,
      name: raidForm.value.name,
      chunkSize: raidForm.value.chunkSize,
      fsType: raidForm.value.fsType,
      autoStart: raidForm.value.autoStart
    })
    
    if (response.data.success) {
      ElNotification.success({
        title: 'Success',
        message: `RAID ${raidForm.value.level} created successfully`,
        duration: 5000
      })
      
      raidDialogVisible.value = false
      await fetchDevices()
      await refreshFilesystems()
    }
    
  } catch (error) {
    if (error === 'cancel') return
    
    const message = error.response?.data?.details || error.message
    ElNotification.error({
      title: 'RAID Error',
      message: message,
      duration: 0
    })
  } finally {
    raidLoading.value = false
  }
}

const showLvmDialog = async () => {
  try {
    loading.value = true
    await fetchDevices()
    lvmDialogVisible.value = true
    lvmForm.value = {
      physicalVolumes: [],
      volumeGroup: 'vg_data',
      logicalVolume: 'lv_storage',
      size: 100,
      unit: '%',
      fsType: 'ext4',
      mountPath: '/mnt/lvm_storage'
    }
  } catch (err) {
    error.value = 'Error loading devices'
    console.error('Error loading devices:', err)
  } finally {
    loading.value = false
  }
}

const createLvm = async () => {
  try {
    lvmLoading.value = true
    
    if (lvmForm.value.physicalVolumes.length === 0) {
      throw new Error('Please select at least one physical volume')
    }
    
    await ElMessageBox.confirm(
      `Creating LVM volume with ${lvmForm.value.physicalVolumes.length} devices. All data will be lost. Continue?`,
      'Confirm LVM Creation',
      {
        confirmButtonText: 'Create LVM',
        cancelButtonText: 'Cancel',
        type: 'error',
        dangerouslyUseHTMLString: true
      }
    )
    
    const size = lvmForm.value.unit === '%' 
      ? `${lvmForm.value.size}%` 
      : `${lvmForm.value.size}G`
    
    const response = await axios.post('/api/storage/lvm/create', {
      physicalVolumes: lvmForm.value.physicalVolumes,
      volumeGroup: lvmForm.value.volumeGroup,
      logicalVolume: lvmForm.value.logicalVolume,
      size: size,
      fsType: lvmForm.value.fsType,
      mountPath: lvmForm.value.mountPath
    })
    
    if (response.data.success) {
      ElNotification.success({
        title: 'Success',
        message: 'LVM volume created successfully',
        duration: 5000
      })
      
      lvmDialogVisible.value = false
      await fetchDevices()
      await refreshFilesystems()
    }
    
  } catch (error) {
    if (error === 'cancel') return
    
    const message = error.response?.data?.details || error.message
    ElNotification.error({
      title: 'LVM Error',
      message: message,
      duration: 0
    })
  } finally {
    lvmLoading.value = false
  }
}

const showDeviceDetails = (fs) => {
  selectedFs.value = fs
  detailsDialogVisible.value = true
}

const checkDevice = async (fs) => {
  try {
    loading.value = true
    const response = await axios.post('/api/storage/check-device', { device: fs.device })
    
    if (response.data.success) {
      ElNotification.success({
        title: 'Device Check',
        message: `Device ${fs.device} is ${response.data.exists ? 'available' : 'not available'}`,
      })
    }
  } catch (error) {
    ElNotification.error({
      title: 'Device Check Error',
      message: error.message,
    })
  } finally {
    loading.value = false
  }
}

const repairFilesystem = async (fs) => {
  try {
    await ElMessageBox.confirm(
      `Repair filesystem on ${fs.device}? This may take some time.`,
      'Confirm Repair',
      {
        confirmButtonText: 'Repair',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    )
    
    loading.value = true
    const response = await axios.post('/api/storage/repair-filesystem', { 
      device: fs.device,
      fsType: fs.type
    })
    
    if (response.data.success) {
      ElNotification.success({
        title: 'Repair Complete',
        message: response.data.message || 'Filesystem repaired successfully',
      })
      await refreshFilesystems()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElNotification.error({
        title: 'Repair Error',
        message: error.response?.data?.details || error.message,
      })
    }
  } finally {
    loading.value = false
  }
}

const editFstabEntry = (fs) => {
  ElNotification.info(`Editing fstab entry for ${fs.device}`)
  openFstabEditor()
}

const toggleFstabEntry = async (fs) => {
  try {
    const response = await axios.post('/api/storage/fstab', {
      action: fs.inFstab ? 'remove' : 'add',
      device: fs.device,
      mountPoint: fs.mounted,
      fsType: fs.type,
      options: 'defaults,nofail'
    })
    
    if (response.data.success) {
      fs.inFstab = !fs.inFstab
      ElNotification.success({
        title: 'Success',
        message: response.data.message,
      })
      await refreshFilesystems()
    }
  } catch (error) {
    ElNotification.error({
      title: 'Error',
      message: error.response?.data?.details || error.message,
    })
  }
}

const unmountFilesystem = async (mountPoint) => {
  try {
    await ElMessageBox.confirm(
      `Unmount filesystem at ${mountPoint}?`,
      'Confirm Unmount',
      {
        confirmButtonText: 'Unmount',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    )
    
    loading.value = true
    const response = await axios.post('/api/storage/unmount', { mountPoint })
    
    ElNotification.success({
      title: 'Success',
      message: response.data.isZfs ?
        'ZFS pool unmounted successfully' :
        'Filesystem unmounted successfully',
    })
    
    await refreshFilesystems()
  } catch (err) {
    if (err === 'cancel') return
    error.value = err.response?.data?.details || err.message
    ElNotification.error({
      title: 'Unmount Error',
      message: error.value,
    })
  } finally {
    loading.value = false
  }
}

const fetchFstabContent = async () => {
  try {
    fstabLoading.value = true
    const response = await api.get('/api/storage/fstab-content')
    fstabContent.value = response.data.content
  } catch (error) {
    ElNotification.error({
      title: 'Error',
      message: error.response?.data?.details || error.message,
    })
  } finally {
    fstabLoading.value = false
  }
}

const saveFstab = async () => {
  try {
    fstabLoading.value = true
    await api.post('/api/storage/save-fstab', { content: fstabContent.value })
    ElNotification.success({
      title: 'Success',
      message: 'Fstab saved successfully',
    })
    fstabDialogVisible.value = false
    await refreshFilesystems()
  } catch (error) {
    ElNotification.error({
      title: 'Error',
      message: error.response?.data?.details || error.message,
    })
  } finally {
    fstabLoading.value = false
  }
}

const openFstabEditor = async () => {
  try {
    await ElMessageBox.confirm(
      'You are about to edit the system fstab file. Make sure you know what you are doing.',
      'Warning',
      {
        confirmButtonText: 'Continue',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }
    )
    fstabDialogVisible.value = true
    await fetchFstabContent()
  } catch (error) {
    if (error !== 'cancel') {
      ElNotification.error({
        title: 'Error',
        message: error.message,
      })
    }
  }
}

const insertFstabTemplate = () => {
  const template = `# /etc/fstab: static file system information.
#
# Use 'blkid' to print the universally unique identifier for a
# device; this may be used with UUID= as a more robust way to name devices
# that works even if disks are added and removed. See fstab(5).
#
# <file system> <mount point>   <type>  <options>       <dump>  <pass>
# /dev/sda1     /               ext4    defaults,noatime 0       1
# UUID=xxxx-xxxx /boot           vfat    defaults        0       2
# /dev/md0      /mnt/raid       ext4    defaults        0       2
# /dev/mapper/vg_data-lv_storage /mnt/lvm ext4 defaults 0       2
`
  fstabContent.value += (fstabContent.value ? '\n\n' : '') + template
}

const validateFstab = async () => {
  try {
    fstabLoading.value = true
    const response = await api.post('/api/storage/validate-fstab', { content: fstabContent.value })
    if (response.data.valid) {
      ElNotification.success({
        title: 'Valid',
        message: 'Fstab syntax is valid',
      })
    } else {
      ElNotification.warning({
        title: 'Validation Warning',
        message: response.data.message || 'Fstab may contain errors',
      })
    }
  } catch (error) {
    ElNotification.error({
      title: 'Error',
      message: error.response?.data?.details || error.message,
    })
  } finally {
    fstabLoading.value = false
  }
}

const debugDevices = async () => {
  try {
    debugDialogVisible.value = true
    
    const response = await axios.get('/api/storage/debug-devices')
    const allDevicesData = response.data.data || []
    
    const formattedDevices = allDevicesData.map(dev => ({
      path: dev.path,
      model: dev.model || 'Unknown',
      mountpoint: dev.mountpoint || '',
      fstype: dev.fstype || '',
      size: dev.size ? parseInt(dev.size) : 0,
      type: dev.type || 'disk'
    }))

    const overlayDevices = formattedDevices.filter(device => 
      isOverlayDevice(device)
    )

    const filteredDevices = filterSystemDevices(formattedDevices)

    debugData.value = {
      allDevices: formattedDevices,
      filteredDevices: filteredDevices,
      overlayDevices: overlayDevices,
      raidDevices: raidDevices.value,
      lvmVolumes: lvmVolumes.value
    }

  } catch (error) {
    ElNotification.error({
      title: 'Debug Error',
      message: 'Failed to fetch debug data',
    })
    console.error('Debug error:', error)
  }
}

const copyDebugData = async () => {
  try {
    const text = JSON.stringify(debugData.value, null, 2)
    await navigator.clipboard.writeText(text)
    ElNotification.success({
      title: 'Success',
      message: 'Debug data copied to clipboard',
    })
  } catch (error) {
    ElNotification.error({
      title: 'Error',
      message: 'Failed to copy data',
    })
  }
}

const exportDebugData = () => {
  try {
    const dataStr = JSON.stringify(debugData.value, null, 2)
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`
    
    const exportFileDefaultName = `storage-debug-${new Date().toISOString().slice(0, 10)}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
    
    ElNotification.success({
      title: 'Success',
      message: 'Debug data exported',
    })
  } catch (error) {
    ElNotification.error({
      title: 'Error',
      message: 'Failed to export data',
    })
  }
}

const handlePageChange = (page) => {
  currentPage.value = page
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
}

// Watch for device changes to update disk size
watch(() => partitionForm.value.device, (newVal) => {
  if (newVal) {
    const device = allDevices.value.find(d => d.path === newVal)
    if (device) {
      totalDiskSize.value = device.size || 0
      updateDiskUsage()
    }
  } else {
    totalDiskSize.value = 0
    usedDiskSpace.value = 0
    diskUsagePercentage.value = 0
  }
})

watch(() => partitionForm.value.partitions, () => {
  updateDiskUsage()
}, { deep: true })

const updateDiskUsage = () => {
  let used = 0
  
  partitionForm.value.partitions.forEach(part => {
    if (part.unit === '%') {
      used += (part.size / 100) * totalDiskSize.value
    } else if (part.unit === 'G') {
      used += part.size * 1024 * 1024 * 1024
    } else { // MB
      used += part.size * 1024 * 1024
    }
  })
  
  usedDiskSpace.value = Math.min(used, totalDiskSize.value)
  diskUsagePercentage.value = Math.round((usedDiskSpace.value / totalDiskSize.value) * 100)
}

// Lifecycle hooks
onMounted(() => {
  refreshFilesystems()
  fetchDevices()
})

onUnmounted(() => {
  abortController.value.abort()
})
</script>

<style scoped>
.filesystems-dashboard {
  padding: 16px;
  min-height: 100vh;
}

:root[data-theme="dark"] .filesystems-dashboard {
  background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
}

/* Compact Header */
.dashboard-header.compact {
  border-radius: 16px;
  margin-bottom: 20px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
}

:root[data-theme="dark"] .dashboard-header.compact {
  background: rgba(45, 55, 72, 0.9);
}

.dashboard-header.compact .header-content {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 30px;
  flex-wrap: nowrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 240px;
}

.header-icon.small {
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  font-size: 24px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.header-text {
  flex: 1;
  min-width: 0;
}

.header-text h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #2d3748;
  line-height: 1.2;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

:root[data-theme="dark"] .header-text h2 {
  background: linear-gradient(135deg, #63b3ed 0%, #4299e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header-text .subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #718096;
  line-height: 1.4;
}

:root[data-theme="dark"] .header-text .subtitle {
  color: #a0aec0;
}

.header-stats {
  display: flex;
  align-items: center;
  gap: 30px;
  margin: 0 30px;
  flex: 1;
  justify-content: center;
}

.stat-item.small {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 110px;
  padding: 12px 16px;
  background: rgba(247, 250, 252, 0.8);
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.6);
  transition: all 0.3s ease;
}

.stat-item.small:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  border-color: #c3dafe;
}

:root[data-theme="dark"] .stat-item.small {
  background: rgba(74, 85, 104, 0.6);
  border-color: rgba(113, 128, 150, 0.4);
}

.stat-item.small .stat-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 10px;
  color: white;
  font-size: 18px;
}

:root[data-theme="dark"] .stat-item.small .stat-icon {
  background: linear-gradient(135deg, #4c51bf 0%, #805ad5 100%);
}

.stat-item.small .stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #2d3748;
  line-height: 1.2;
}

:root[data-theme="dark"] .stat-item.small .stat-value {
  color: #f7fafc;
}

.stat-item.small .stat-label {
  font-size: 12px;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
  font-weight: 500;
}

:root[data-theme="dark"] .stat-item.small .stat-label {
  color: #cbd5e0;
}

.header-actions.compact {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* Combined Card */
.combined-card {
  border-radius: 16px;
  margin-bottom: 20px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
}

:root[data-theme="dark"] .combined-card {
  background: rgba(45, 55, 72, 0.9);
}

.combined-content {
  padding: 20px;
}

.quick-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.right-actions {
  display: flex;
  gap: 12px;
}

/* Modern Filesystems List Card */
.filesystems-list-card.modern-table {
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border: none;
}

:root[data-theme="dark"] .filesystems-list-card.modern-table {
  background: rgba(45, 55, 72, 0.9);
}

.list-header.modern {
  padding: 20px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

:root[data-theme="dark"] .list-header.modern {
  border-bottom-color: rgba(113, 128, 150, 0.4);
}

.search-section {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input.modern {
  width: 240px;
}

.search-input.modern :deep(.el-input__wrapper) {
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: rgba(247, 250, 252, 0.8);
  transition: all 0.3s ease;
}

.search-input.modern :deep(.el-input__wrapper:hover) {
  border-color: #c3dafe;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
}

.search-input.modern :deep(.el-input__wrapper.is-focus) {
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
}

.filter-select.modern,
.sort-select {
  width: 140px;
}

.filter-select.modern :deep(.el-input__wrapper),
.sort-select :deep(.el-input__wrapper) {
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: rgba(247, 250, 252, 0.8);
}

:root[data-theme="dark"] .filter-select.modern :deep(.el-input__wrapper),
:root[data-theme="dark"] .sort-select :deep(.el-input__wrapper) {
  background: rgba(74, 85, 104, 0.6);
  border-color: rgba(113, 128, 150, 0.4);
  color: #f7fafc;
}

.sort-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-btn {
  padding: 8px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: rgba(247, 250, 252, 0.8);
}

:root[data-theme="dark"] .sort-btn {
  background: rgba(74, 85, 104, 0.6);
  border-color: rgba(113, 128, 150, 0.4);
  color: #f7fafc;
}

/* Modern Alert */
.modern-alert {
  margin: 0 20px 20px;
  border-radius: 10px;
  border: none;
}

/* Modern Loading State */
.loading-state.modern {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #718096;
  font-size: 15px;
  gap: 16px;
  flex-direction: column;
}

:root[data-theme="dark"] .loading-state.modern {
  color: #a0aec0;
}

.spinner-container {
  position: relative;
  width: 60px;
  height: 60px;
}

.spinner {
  width: 100%;
  height: 100%;
  border: 4px solid rgba(102, 126, 234, 0.1);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 12px;
  font-weight: 500;
}

/* Modern Empty State */
.empty-state.modern {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  gap: 30px;
  text-align: center;
  flex-direction: column;
}

.empty-illustration {
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 20px;
  color: #667eea;
}

:root[data-theme="dark"] .empty-illustration {
  background: rgba(99, 179, 237, 0.1);
  color: #63b3ed;
}

.empty-content h4 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
}

:root[data-theme="dark"] .empty-content h4 {
  color: #f7fafc;
}

.empty-content p {
  margin: 0 0 20px;
  font-size: 14px;
  color: #718096;
  max-width: 400px;
}

:root[data-theme="dark"] .empty-content p {
  color: #a0aec0;
}

.empty-action-btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-weight: 500;
}

/* Modern Filesystems Grid */
.filesystems-grid {
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.filesystem-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.filesystem-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
  border-color: #c3dafe;
}

.filesystem-card.selected {
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
  background: rgba(66, 153, 225, 0.02);
}

.filesystem-card.critical {
  border-left: 4px solid #f56565;
}

.filesystem-card.warning {
  border-left: 4px solid #ed8936;
}

:root[data-theme="dark"] .filesystem-card {
  background: #2d3748;
  border-color: #4a5568;
}

:root[data-theme="dark"] .filesystem-card:hover {
  border-color: #63b3ed;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

/* Card Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.device-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.device-icon {
  position: relative;
  flex-shrink: 0;
}

.device-status-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid white;
}

.device-status-indicator.active {
  background: #48bb78;
}

.device-status-indicator.inactive {
  background: #a0aec0;
}

.device-status-indicator.readonly {
  background: #ed8936;
}

.device-status-indicator.error {
  background: #f56565;
}

.device-details {
  flex: 1;
  min-width: 0;
}

.device-name {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:root[data-theme="dark"] .device-name {
  color: #f7fafc;
}

.device-path {
  font-size: 12px;
  color: #718096;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:root[data-theme="dark"] .device-path {
  color: #a0aec0;
}

.card-actions {
  flex-shrink: 0;
}

.action-btn {
  padding: 6px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: rgba(247, 250, 252, 0.8);
}

:root[data-theme="dark"] .action-btn {
  background: rgba(74, 85, 104, 0.6);
  border-color: rgba(113, 128, 150, 0.4);
  color: #f7fafc;
}

/* Card Tags */
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.card-tags .el-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 8px;
}

/* Mount Info */
.mount-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  background: rgba(247, 250, 252, 0.8);
  border-radius: 10px;
  margin-bottom: 16px;
  border: 1px solid #e2e8f0;
}

:root[data-theme="dark"] .mount-info {
  background: rgba(74, 85, 104, 0.6);
  border-color: rgba(113, 128, 150, 0.4);
}

.mount-info .iconify {
  color: #718096;
  flex-shrink: 0;
}

:root[data-theme="dark"] .mount-info .iconify {
  color: #a0aec0;
}

.mount-path {
  font-size: 13px;
  color: #4a5568;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:root[data-theme="dark"] .mount-path {
  color: #cbd5e0;
}

/* Usage Section */
.usage-section {
  margin-bottom: 20px;
}

.usage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.usage-label {
  font-size: 13px;
  color: #718096;
  font-weight: 500;
}

:root[data-theme="dark"] .usage-label {
  color: #a0aec0;
}

.usage-percent {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
}

:root[data-theme="dark"] .usage-percent {
  color: #f7fafc;
}

.usage-bar.modern {
  margin: 0 0 8px;
}

.usage-bar.modern :deep(.el-progress-bar__outer) {
  border-radius: 10px;
  background: rgba(237, 242, 247, 0.8);
}

:root[data-theme="dark"] .usage-bar.modern :deep(.el-progress-bar__outer) {
  background: rgba(74, 85, 104, 0.6);
}

.usage-details {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #718096;
}

.usage-details .used {
  font-weight: 600;
  color: #2d3748;
}

:root[data-theme="dark"] .usage-details .used {
  color: #f7fafc;
}

.usage-details .separator {
  color: #cbd5e0;
}

.usage-details .total {
  color: #4a5568;
}

:root[data-theme="dark"] .usage-details .total {
  color: #cbd5e0;
}

.usage-details .free {
  margin-left: auto;
  color: #a0aec0;
}

/* Filesystem Type */
.filesystem-type {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

:root[data-theme="dark"] .filesystem-type {
  border-top-color: #4a5568;
}

.fs-type-tag {
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(247, 250, 252, 0.8);
  border: 1px solid #e2e8f0;
}

:root[data-theme="dark"] .fs-type-tag {
  background: rgba(74, 85, 104, 0.6);
  border-color: rgba(113, 128, 150, 0.4);
  color: #f7fafc;
}

.fs-size {
  font-size: 13px;
  color: #718096;
  font-weight: 500;
}

:root[data-theme="dark"] .fs-size {
  color: #a0aec0;
}

/* Modern Pagination */
.pagination.modern {
  padding: 20px;
  border-top: 1px solid rgba(226, 232, 240, 0.8);
}

:root[data-theme="dark"] .pagination.modern {
  border-top-color: rgba(113, 128, 150, 0.4);
}

.pagination.modern :deep(.el-pagination) {
  justify-content: center;
}

.pagination.modern :deep(.btn-prev),
.pagination.modern :deep(.btn-next),
.pagination.modern :deep(.el-pager li) {
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: rgba(247, 250, 252, 0.8);
  margin: 0 4px;
}

:root[data-theme="dark"] .pagination.modern :deep(.btn-prev),
:root[data-theme="dark"] .pagination.modern :deep(.btn-next),
:root[data-theme="dark"] .pagination.modern :deep(.el-pager li) {
  background: rgba(74, 85, 104, 0.6);
  border-color: rgba(113, 128, 150, 0.4);
  color: #f7fafc;
}

.pagination.modern :deep(.el-pager li.is-active) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  color: white;
  font-weight: 600;
}

/* Dialog Styles */
.storage-dialog :deep(.el-dialog) {
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
}

:root[data-theme="dark"] .storage-dialog :deep(.el-dialog) {
  background: rgba(45, 55, 72, 0.95);
}

.storage-dialog :deep(.el-dialog__header) {
  padding: 24px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  margin: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

:root[data-theme="dark"] .storage-dialog :deep(.el-dialog__header) {
  border-bottom-color: rgba(113, 128, 150, 0.4);
}

.storage-dialog :deep(.el-dialog__title) {
  font-size: 20px;
  font-weight: 700;
  color: white;
}

.storage-dialog :deep(.el-dialog__body) {
  padding: 24px;
}

:root[data-theme="dark"] .storage-dialog :deep(.el-dialog__body) {
  color: #f7fafc;
}

.full-width {
  width: 100%;
}

.device-select-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  width: 100%;
}

.device-name {
  font-weight: 600;
  color: #2d3748;
  flex: 1;
}

:root[data-theme="dark"] .device-name {
  color: #f7fafc;
}

.device-meta {
  font-size: 12px;
  color: #718096;
}

:root[data-theme="dark"] .device-meta {
  color: #a0aec0;
}

.device-info-card {
  background: rgba(247, 250, 252, 0.8);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
}

:root[data-theme="dark"] .device-info-card {
  background: rgba(74, 85, 104, 0.6);
  border-color: rgba(113, 128, 150, 0.4);
}

.device-info-card h4 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

:root[data-theme="dark"] .device-info-card h4 {
  color: #f7fafc;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-label {
  font-size: 13px;
  color: #718096;
  min-width: 80px;
}

:root[data-theme="dark"] .info-label {
  color: #a0aec0;
}

.info-value {
  font-size: 13px;
  color: #2d3748;
  font-weight: 500;
}

:root[data-theme="dark"] .info-value {
  color: #f7fafc;
}

.fs-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.warning-section {
  margin: 20px 0;
}

.switch-label {
  margin-left: 8px;
  font-size: 13px;
  color: #718096;
}

:root[data-theme="dark"] .switch-label {
  color: #a0aec0;
}

/* Dialog Footer */
.storage-dialog :deep(.el-dialog__footer) {
  padding: 20px 24px;
  background: rgba(247, 250, 252, 0.8);
  border-top: 1px solid rgba(226, 232, 240, 0.8);
}

:root[data-theme="dark"] .storage-dialog :deep(.el-dialog__footer) {
  background: rgba(74, 85, 104, 0.6);
  border-top-color: rgba(113, 128, 150, 0.4);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;
}

/* Responsive Design */
@media (max-width: 1400px) {
  .filesystems-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
}

@media (max-width: 1200px) {
  .filesystems-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
  
  .header-stats {
    gap: 20px;
  }
  
  .stat-item.small {
    min-width: 100px;
  }
}

@media (max-width: 1024px) {
  .dashboard-header.compact .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
  }
  
  .header-left {
    min-width: auto;
  }
  
  .header-stats {
    order: 2;
    justify-content: space-around;
    gap: 16px;
  }
  
  .stat-item.small {
    flex-direction: column;
    text-align: center;
    gap: 8px;
    min-width: 90px;
  }
  
  .header-actions.compact {
    order: 3;
    width: 100%;
    justify-content: center;
  }
  
  .quick-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .right-actions {
    justify-content: center;
  }
  
  .filesystems-grid {
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }
}

@media (max-width: 768px) {
  .filesystems-dashboard {
    padding: 12px;
  }
  
  .filesystems-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .list-header.modern {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-section {
    width: 100%;
  }
  
  .search-input.modern {
    flex: 1;
  }
  
  .header-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  
  .stat-item.small {
    min-width: auto;
  }
}

@media (max-width: 640px) {
  .header-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .search-section {
    flex-direction: column;
  }
  
  .search-input.modern,
  .filter-select.modern,
  .sort-select {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .header-stats {
    grid-template-columns: 1fr;
  }
  
  .device-info {
    flex-direction: column;
  }
  
  .card-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .card-actions {
    align-self: flex-end;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(247, 250, 252, 0.8);
  border-radius: 4px;
}

:root[data-theme="dark"] ::-webkit-scrollbar-track {
  background: rgba(74, 85, 104, 0.6);
}

::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 4px;
}

:root[data-theme="dark"] ::-webkit-scrollbar-thumb {
  background: #718096;
}

::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}

:root[data-theme="dark"] ::-webkit-scrollbar-thumb:hover {
  background: #4a5568;
}

/* Smooth transitions */
.filesystem-card,
.stat-item.small,
.search-input.modern :deep(.el-input__wrapper),
.filter-select.modern :deep(.el-input__wrapper),
.action-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Glass morphism effects */
.glass-effect {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

:root[data-theme="dark"] .glass-effect {
  background: rgba(45, 55, 72, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Gradient text */
.gradient-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

:root[data-theme="dark"] .gradient-text {
  background: linear-gradient(135deg, #63b3ed 0%, #4299e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
