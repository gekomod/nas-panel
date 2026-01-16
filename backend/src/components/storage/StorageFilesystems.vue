<template>
  <el-card class="filesystems-widget" :body-style="{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column' }">
    <!-- Header -->
    <template #header>
      <div class="widget-header">
        <div class="header-content">
          <div class="header-main">
            <Icon icon="mdi:file-tree" width="24" height="24" class="header-icon" />
            <div class="header-text">
              <h3 class="header-title">{{ $t('storageFilesystems.title') }}</h3>
              <p class="header-subtitle">{{ $t('storageFilesystems.subtitle') || 'Manage filesystems and storage devices' }}</p>
            </div>
          </div>
          <div class="header-actions">
            <el-button-group class="main-actions">
              <el-tooltip content="Mount device">
                <el-button 
                  @click="showMountDialog" 
                  :disabled="loading"
                  type="primary"
                  size="small"
                >
                  <Icon icon="streamline-cyber-color:harddisk-4" width="18" height="18" />
                  <span class="button-text">Mount</span>
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Partition disk">
                <el-button 
                  @click="showPartitionDialog" 
                  :disabled="loading"
                  size="small"
                >
                  <Icon icon="mdi:harddisk-plus" width="18" height="18" />
                  <span class="button-text">Partition</span>
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Format device">
                <el-button 
                  @click="showFormatDialog" 
                  :disabled="loading"
                  size="small"
                >
                  <Icon icon="icon-park:clear-format" width="18" height="18" />
                  <span class="button-text">Format</span>
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Create RAID">
                <el-button 
                  @click="showRaidDialog" 
                  :disabled="loading"
                  size="small"
                >
                  <Icon icon="icon-park:solid-state-disk" width="18" height="18" />
                  <span class="button-text">RAID</span>
                </el-button>
              </el-tooltip>
            </el-button-group>
            
            <div class="tool-actions">
              <el-tooltip content="Edit fstab">
                <el-button 
                  @click="openFstabEditor" 
                  :disabled="loading"
                  size="small"
                  circle
                  plain
                >
                  <Icon icon="mdi:file-edit" width="18" height="18" />
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Debug devices">
                <el-button 
                  @click="debugDevices" 
                  :disabled="loading"
                  size="small"
                  circle
                  plain
                  type="warning"
                >
                  <Icon icon="mdi:bug" width="18" height="18" />
                </el-button>
              </el-tooltip>
              
              <el-tooltip content="Refresh">
                <el-button 
                  @click="refreshFilesystems" 
                  :loading="loading"
                  size="small"
                  circle
                  plain
                >
                  <Icon icon="mdi:refresh" width="18" height="18" :class="{ 'spin': loading }" />
                </el-button>
              </el-tooltip>
            </div>
          </div>
        </div>
        
        <!-- Stats -->
        <div v-if="filesystems.length > 0" class="stats-container">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">
                <Icon icon="mdi:harddisk" width="20" height="20" />
              </div>
              <div class="stat-details">
                <div class="stat-value">{{ filesystems.length }}</div>
                <div class="stat-label">Devices</div>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">
                <Icon icon="mdi:chart-pie" width="20" height="20" />
              </div>
              <div class="stat-details">
                <div class="stat-value">{{ totalUsedPercent }}%</div>
                <div class="stat-label">Used</div>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">
                <Icon icon="mdi:database" width="20" height="20" />
              </div>
              <div class="stat-details">
                <div class="stat-value">{{ formatBytes(totalCapacity) }}</div>
                <div class="stat-label">Capacity</div>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">
                <Icon icon="mdi:auto-fix" width="20" height="20" />
              </div>
              <div class="stat-details">
                <div class="stat-value">{{ autoMountCount }}</div>
                <div class="stat-label">Auto-mount</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Main Content -->
    <div class="widget-content">
      <div class="content-container">
        <div class="table-container" v-loading="loading">
          <el-table 
            :data="filesystems" 
            empty-text="No filesystems found"
            size="small"
            stripe
            highlight-current-row
            class="filesystems-table"
            :max-height="tableHeight"
          >
            <el-table-column prop="device" label="Device" width="160" fixed>
              <template #default="{ row }">
                <div class="device-cell">
                  <el-tag :type="getDeviceTagType(row.device)" size="small" class="device-tag">
                    <Icon :icon="getDeviceIcon(row.device)" width="14" height="14" />
                    <span>{{ getDeviceShortName(row.device) }}</span>
                  </el-tag>
                  <div class="device-info">
                    <span class="device-path">{{ row.device }}</span>
                    <span v-if="row.tags" class="device-tags">
                      <el-tag size="mini" type="info">{{ row.tags }}</el-tag>
                    </span>
                  </div>
                </div>
              </template>
            </el-table-column>
            
            <el-table-column prop="type" label="Type" width="120">
              <template #default="{ row }">
                <div class="fs-type">
                  <el-tag :type="getFsTagType(row.type)" size="small" effect="light">
                    <Icon :icon="getFsIcon(row.type)" width="14" height="14" />
                    <span>{{ row.type.toUpperCase() }}</span>
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            
            <el-table-column prop="mounted" label="Mount Point" width="200">
              <template #default="{ row }">
                <div class="mount-cell">
                  <Icon icon="mdi:folder" width="16" height="16" class="mount-icon" />
                  <span class="mount-path" :title="row.mounted">{{ truncatePath(row.mounted, 30) }}</span>
                </div>
              </template>
            </el-table-column>
            
            <el-table-column prop="used" label="Usage" width="240">
              <template #default="{ row }">
                <div class="usage-cell">
                  <div class="usage-info">
                    <span class="usage-percent">{{ row.usedPercent }}%</span>
                    <span class="usage-size">{{ formatBytes(row.used) }} / {{ formatBytes(row.size) }}</span>
                  </div>
                  <el-progress 
                    :percentage="row.usedPercent" 
                    :color="getUsageColor(row.usedPercent)"
                    :show-text="false"
                    :stroke-width="8"
                    class="usage-bar"
                  />
                </div>
              </template>
            </el-table-column>
            
            <el-table-column prop="status" label="Status" width="120">
              <template #default="{ row }">
                <el-tag 
                  :type="getStatusType(row.status)" 
                  size="small"
                  :effect="row.status === 'active' ? 'dark' : 'plain'"
                  class="status-tag"
                >
                  <Icon :icon="getStatusIcon(row.status)" width="12" height="12" />
                  <span class="status-text">{{ row.status }}</span>
                  <span v-if="row.readOnly" class="read-only-badge">RO</span>
                </el-tag>
              </template>
            </el-table-column>
            
            <el-table-column label="Auto-mount" width="100">
              <template #default="{ row }">
                <div class="auto-mount-cell">
                  <el-switch
                    v-if="!row.isZfs"
                    v-model="row.inFstab"
                    @change="toggleFstabEntry(row.device, row.mounted, row.type, row.options, $event)"
                    :loading="row.fstabLoading"
                    size="small"
                    active-color="#13ce66"
                  />
                  <el-tag v-else type="info" size="small" effect="plain">ZFS</el-tag>
                </div>
              </template>
            </el-table-column>
            
            <el-table-column label="Actions" width="120" fixed="right">
              <template #default="{ row }">
                <div class="action-buttons">
                  <el-tooltip content="Unmount" placement="top">
                    <el-button 
                      size="small" 
                      @click="unmountFilesystem(row.mounted)" 
                      :disabled="row.status !== 'active'"
                      circle
                      :type="row.status === 'active' ? 'danger' : 'info'"
                      class="action-btn"
                    >
                      <Icon icon="mdi:eject" width="16" height="16" />
                    </el-button>
                  </el-tooltip>
                  
                  <el-dropdown trigger="click" placement="bottom-end">
                    <el-button size="small" circle class="action-btn">
                      <Icon icon="mdi:dots-vertical" width="16" height="16" />
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item @click="showDeviceActions(row)">
                          <Icon icon="mdi:information" width="16" height="16" />
                          Info
                        </el-dropdown-item>
                        <el-dropdown-item @click="checkDevice(row)" :disabled="row.status !== 'active'">
                          <Icon icon="mdi:check-circle" width="16" height="16" />
                          Check
                        </el-dropdown-item>
                        <el-dropdown-item divided @click="editFstabEntry(row)">
                          <Icon icon="mdi:pencil" width="16" height="16" />
                          Edit fstab
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- Empty State -->
        <div v-if="!loading && filesystems.length === 0" class="empty-state">
          <div class="empty-content">
            <Icon icon="mdi:harddisk-remove" width="64" height="64" class="empty-icon" />
            <h3>No Filesystems Found</h3>
            <p>No mounted filesystems detected. Mount a device to get started.</p>
            <el-button type="primary" @click="showMountDialog" :disabled="loading">
              <Icon icon="streamline-cyber-color:harddisk-4" width="18" height="18" />
              Mount First Device
            </el-button>
          </div>
        </div>

        <!-- Error State -->
        <div v-if="error" class="error-state">
          <el-alert 
            title="Error Loading Filesystems" 
            type="error" 
            :description="error"
            show-icon
            :closable="true"
            @close="error = null"
          />
        </div>
      </div>
    </div>

    <!-- Mount Dialog -->
    <el-dialog 
      v-model="mountDialogVisible" 
      title="Mount Device" 
      width="500px"
      class="storage-dialog"
    >
      <el-form :model="mountForm" label-position="top">
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
                  <Icon :icon="getDeviceIcon(device.path)" width="16" height="16" />
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
                  <Icon icon="mdi:harddisk-partition" width="16" height="16" />
                  <span class="device-name">{{ partition.path }}</span>
                  <span class="device-meta">{{ partition.fstype || 'Unknown' }} • {{ formatBytes(partition.size) }}</span>
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
            <div v-if="selectedDeviceInfo.isZfs" class="info-row">
              <span class="info-label">Type:</span>
              <el-tag type="primary" size="small">ZFS Pool</el-tag>
            </div>
          </div>
        </div>
        
        <el-form-item 
          v-if="!selectedDeviceInfo?.isZfs"
          label="Mount Point" 
          required
        >
          <el-input 
            v-model="mountForm.mountPoint" 
            :placeholder="getDefaultMountPoint()"
            :prefix-icon="FolderIcon"
          />
        </el-form-item>
        
        <el-form-item 
          v-if="!selectedDeviceInfo?.fsType && !selectedDeviceInfo?.isZfs"
          label="Filesystem Type"
        >
          <el-select v-model="mountForm.fsType" style="width: 100%">
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
          v-if="!selectedDeviceInfo?.isZfs"
          label="Options"
        >
          <el-input v-model="mountForm.options" placeholder="defaults,nofail" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="mountDialogVisible = false">
            Cancel
          </el-button>
          <el-button 
            type="primary" 
            @click="mountDevice" 
            :loading="mountLoading"
            :disabled="!mountForm.device || (selectedDeviceInfo?.isZfs && !mountForm.zfsPoolName)"
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
      width="500px"
      class="storage-dialog warning-dialog"
    >
      <el-form :model="formatForm" label-position="top">
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
                  <Icon icon="mdi:harddisk-partition" width="16" height="16" />
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
                  <Icon :icon="getDeviceIcon(device.path)" width="16" height="16" />
                  <span class="device-name">{{ device.path }}</span>
                  <span class="device-meta">Disk • {{ formatBytes(device.size) }}</span>
                </div>
              </el-option>
            </el-option-group>
          </el-select>
        </el-form-item>
        
        <el-form-item label="Filesystem Type" required>
          <el-select v-model="formatForm.fsType" style="width: 100%">
            <el-option
              v-for="fs in supportedFilesystems"
              :key="fs"
              :label="fs.toUpperCase()"
              :value="fs.toLowerCase()"
            >
              <div class="fs-option">
                <Icon :icon="getFsIcon(fs)" width="16" height="16" />
                <span>{{ fs.toUpperCase() }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        
        <div v-if="formatForm.fsType === 'zfs'" class="warning-section">
          <el-alert type="warning" :closable="false">
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
      </el-form>
      
      <div class="warning-section" v-if="formatForm.device">
        <el-alert type="error" :closable="false">
          <template #title>
            <strong>WARNING: DATA LOSS</strong>
          </template>
          All data on <strong>{{ formatForm.device }}</strong> will be permanently deleted!
        </el-alert>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="formatDialogVisible = false">
            Cancel
          </el-button>
          <el-button 
            type="danger" 
            @click="formatDevice" 
            :loading="formatLoading"
            :disabled="!formatForm.device || !formatForm.fsType"
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
      <el-form :model="partitionForm" label-position="top">
        <el-form-item label="Device" required>
          <el-select 
            v-model="partitionForm.device" 
            style="width: 100%"
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
                <Icon :icon="getDeviceIcon(device.path)" width="16" height="16" />
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
              :stroke-width="16"
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
                      :step="part.unit === '%' ? 1 : (part.unit === 'G' ? 10 : 100)}"
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
                    </el-select>
                  </div>
                  <div class="size-info">
                    <span>{{ calculatePartitionSize(part) }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <el-button @click="addPartition" type="primary" text class="add-partition-btn">
              <Icon icon="mdi:plus" />
              Add Partition
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="partitionDialogVisible = false">
            Cancel
          </el-button>
          <el-button 
            type="primary" 
            @click="createPartitions" 
            :loading="partitionLoading"
            :disabled="partitionForm.partitions.length === 0"
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
      <el-form :model="raidForm" label-position="top">
        <el-form-item label="RAID Level" required>
          <el-select v-model="raidForm.level" style="width: 100%" @change="updateRaidInfo">
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
            style="width: 100%"
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
                <Icon :icon="getDeviceIcon(device.path)" width="16" height="16" />
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
          <el-select v-model="raidForm.chunkSize" style="width: 100%">
            <el-option label="64 KB" value="64" />
            <el-option label="128 KB" value="128" />
            <el-option label="256 KB" value="256" />
            <el-option label="512 KB" value="512" />
          </el-select>
        </el-form-item>
      </el-form>
      
      <div class="raid-info-section">
        <div class="info-card">
          <div class="info-card-header">
            <Icon :icon="raidInfo.icon" width="18" height="18" />
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
      
      <div class="warning-section" v-if="raidForm.devices.length > 0">
        <el-alert type="error" :closable="false">
          <template #title>
            <strong>WARNING: DATA LOSS</strong>
          </template>
          All data on selected devices will be permanently deleted!
        </el-alert>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="raidDialogVisible = false">
            Cancel
          </el-button>
          <el-button 
            type="primary" 
            @click="createRaid" 
            :loading="raidLoading"
            :disabled="raidForm.devices.length < requiredDevicesForLevel"
          >
            Create RAID
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
        <el-alert type="warning" :closable="false" style="margin-bottom: 15px;">
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
          <el-button @click="fstabDialogVisible = false">
            Cancel
          </el-button>
          <el-button type="primary" @click="saveFstab" :loading="fstabLoading">
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
        <!-- All Devices -->
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
                    <Icon :icon="getDeviceIcon(row.path)" width="14" height="14" />
                    <span>{{ row.path }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="model" label="Model" width="120" />
              <el-table-column prop="type" label="Type" width="80">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.type === 'disk' ? '' : 'info'">
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

        <!-- Filtered Devices -->
        <el-tab-pane label="Filtered (Visible)">
          <div class="tab-content">
            <div class="tab-header">
              <h4>Visible Devices (After Filtering)</h4>
              <el-tag type="info">
                {{ debugData.filteredDevices.length }} devices
              </el-tag>
            </div>
            <el-table 
              :data="debugData.filteredDevices" 
              stripe 
              border
              height="400"
              size="small"
              class="debug-table"
            >
              <el-table-column prop="path" label="Path" width="150" fixed>
                <template #default="{ row }">
                  <div class="device-path-cell">
                    <Icon :icon="getDeviceIcon(row.path)" width="14" height="14" />
                    <span>{{ row.path }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="model" label="Model" width="120" />
              <el-table-column prop="type" label="Type" width="80" />
              <el-table-column prop="fstype" label="Filesystem" width="100" />
              <el-table-column prop="mountpoint" label="Mount Point" width="200" show-overflow-tooltip />
              <el-table-column prop="size" label="Size" width="100" sortable>
                <template #default="{ row }">
                  {{ formatBytes(row.size) }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <!-- Hidden Overlay -->
        <el-tab-pane label="Hidden Overlay Devices">
          <div class="tab-content">
            <div class="tab-header">
              <h4>Overlay/Docker Devices (Hidden from UI)</h4>
              <el-tag type="danger">
                {{ debugData.overlayDevices.length }} hidden devices
              </el-tag>
            </div>
            <el-table 
              :data="debugData.overlayDevices" 
              stripe 
              border
              height="400"
              size="small"
              class="debug-table"
            >
              <el-table-column prop="path" label="Path" width="150" fixed>
                <template #default="{ row }">
                  <div class="device-path-cell">
                    <Icon icon="mdi:layers" width="14" height="14" />
                    <span>{{ row.path }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="model" label="Model" width="120" />
              <el-table-column prop="type" label="Type" width="80" />
              <el-table-column prop="fstype" label="Filesystem" width="100" />
              <el-table-column prop="mountpoint" label="Mount Point" width="200" show-overflow-tooltip />
              <el-table-column prop="size" label="Size" width="100">
                <template #default="{ row }">
                  {{ formatBytes(row.size) }}
                </template>
              </el-table-column>
              <el-table-column label="Hidden Reason" width="150">
                <template #default="{ row }">
                  <el-tag type="danger" size="small" effect="plain">
                    {{ getOverlayReason(row) }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <div class="debug-footer">
          <div class="debug-actions">
            <el-button @click="debugDialogVisible = false">
              Close
            </el-button>
            <el-button type="primary" @click="copyDebugData">
              <Icon icon="mdi:content-copy" />
              Copy JSON
            </el-button>
            <el-button type="warning" @click="exportDebugData">
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
  </el-card>
</template>

<script>
export default {
  name: 'StorageFilesystemsWidget',
  displayName: 'Filesystems'
}
</script>

<script setup>
import { ref, onMounted, computed, onUnmounted, watch, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import axios from 'axios'
import { ElMessage, ElNotification, ElMessageBox } from 'element-plus'

const { t } = useI18n()
const abortController = ref(new AbortController())

const api = axios.create({
  baseURL: `${window.location.protocol}//${window.location.hostname}:1112`,
  signal: abortController.value.signal
})

// Define FolderIcon for prefix-icon
const FolderIcon = h('i', { class: 'el-icon el-icon-folder' })

// Reactive state
const filesystems = ref([])
const allDevices = ref([])
const loading = ref(false)
const error = ref(null)

// Dialog states
const mountDialogVisible = ref(false)
const mountLoading = ref(false)
const formatDialogVisible = ref(false)
const formatLoading = ref(false)
const partitionDialogVisible = ref(false)
const partitionLoading = ref(false)
const raidDialogVisible = ref(false)
const raidLoading = ref(false)
const fstabDialogVisible = ref(false)
const fstabLoading = ref(false)
const fstabContent = ref('')
const debugDialogVisible = ref(false)

// Form models
const mountForm = ref({
  device: '',
  mountPoint: '',
  fsType: 'auto',
  options: 'defaults,nofail',
  zfsPoolName: ''
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
  chunkSize: '128'
})

const selectedDeviceInfo = ref(null)
const fstabEntries = ref([])
const debugData = ref({
  allDevices: [],
  filteredDevices: [],
  overlayDevices: []
})

// Disk size for partition dialog
const totalDiskSize = ref(0)
const usedDiskSpace = ref(0)
const diskUsagePercentage = ref(0)

// Computed properties
const supportedFilesystems = ref([
  'bcachefs', 'btrfs', 'ext4', 'f2fs', 'jfs', 'xfs', 'zfs', 'ntfs', 'vfat', 'exfat'
])

const allAvailableDevices = computed(() => {
  return filterSystemDevices(allDevices.value.filter(device => 
    device.type === 'disk' && 
    !device.path.includes('loop')
  ))
})

const allAvailablePartitions = computed(() => {
  return allDevices.value.flatMap(device => 
    (device.partitions || []).map(part => ({
      ...part,
      model: device.model || 'Unknown',
      size: part.size ? parseInt(part.size) : 0
    }))
  ).filter(part => !part.path.includes('loop'))
})

const isMobile = computed(() => window.innerWidth < 768)
const tableHeight = computed(() => window.innerHeight - 320)

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

const mountableDevices = computed(() => {
  const mountedPaths = filesystems.value.map(fs => fs.device)
  
  const devices = allDevices.value.filter(device => 
    !mountedPaths.includes(device.path) && 
    device.type === 'disk'
  )
  
  const partitions = allDevices.value.flatMap(device => 
    (device.partitions || [])
      .filter(part => !mountedPaths.includes(part.path))
      .map(part => ({
        ...part,
        model: device.model || 'Unknown'
      }))
  )

  return filterSystemDevices([...devices, ...partitions])
})

const partitionableDevices = computed(() => {
  return allDevices.value.filter(device => 
    (device.type === 'disk' || device.path.includes('/dev/md')) && 
    !device.path.includes('loop') &&
    !isSystemDisk(device.path)
  )
})

const raidEligibleDevices = computed(() => {
  return allDevices.value.filter(device => 
    device.type === 'disk' && 
    !device.path.includes('loop') &&
    !isSystemDisk(device.path) &&
    !device.path.includes('md') &&
    !device.model?.includes('RAID')
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

// Methods
const showDeviceActions = (row) => {
  ElMessageBox({
    title: `Device: ${row.device}`,
    message: `Mount point: ${row.mounted}`,
    showCancelButton: true,
    showClose: true,
  })
}

const checkDevice = (row) => {
  ElNotification.info(`Checking device ${row.device}...`)
}

const editFstabEntry = (row) => {
  ElNotification.info(`Editing fstab entry for ${row.device}`)
}

const onDeviceSelected = async (devicePath) => {
  const device = mountableDevices.value.find(d => d.path === devicePath)
  if (!device) return

  selectedDeviceInfo.value = {
    path: device.path,
    fsType: device.fstype,
    size: device.size,
    label: device.label,
    isRaid: device.path.includes('/dev/md'),
    isZfs: device.fstype === 'zfs' || device.path.includes('zfs')
  }

  if (!selectedDeviceInfo.value.isZfs) {
    mountForm.value.mountPoint = getDefaultMountPoint()
  }

  if (selectedDeviceInfo.value.fsType) {
    mountForm.value.fsType = selectedDeviceInfo.value.fsType
  } else if (selectedDeviceInfo.value.isZfs) {
    mountForm.value.fsType = 'zfs'
  }
}

const getDefaultMountPoint = () => {
  const device = selectedDeviceInfo.value
  if (!device) return '/mnt/new_disk'
  
  let baseName = device.path.split('/').pop()
  if (device.label) {
    baseName = device.label.toLowerCase().replace(/\s+/g, '_')
  }
  
  return `/mnt/${baseName}`
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

const getDeviceShortName = (path) => {
  return path.split('/').pop()
}

const getDeviceTagType = (device) => {
  if (device.includes('nvme')) return 'primary'
  if (device.includes('md')) return 'warning'
  if (device.includes('zfs')) return 'success'
  return ''
}

const getFsTagType = (type) => {
  const types = {
    ext4: 'success',
    xfs: 'primary',
    zfs: 'warning',
    btrfs: 'info',
    ntfs: '',
    vfat: '',
    exfat: ''
  }
  return types[type.toLowerCase()] || ''
}

const getDeviceIcon = (device) => {
  if (device?.includes('nvme')) return 'mdi:memory'
  if (device?.includes('sd')) return 'mdi:harddisk'
  if (device?.includes('md')) return 'mdi:raid'
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
    jfs: 'mdi:file-tree'
  }
  return icons[type.toLowerCase()] || 'mdi:file-question'
}

const getStatusIcon = (status) => {
  const icons = {
    active: 'mdi:check-circle',
    inactive: 'mdi:close-circle',
    readonly: 'mdi:lock',
    error: 'mdi:alert-circle',
    unknown: 'mdi:help-circle'
  }
  return icons[status.toLowerCase()] || 'mdi:help-circle'
}

const getStatusType = (status) => {
  const types = {
    active: 'success',
    inactive: 'info',
    readonly: 'warning',
    error: 'danger',
    unknown: ''
  }
  return types[status.toLowerCase()] || ''
}

const getUsageColor = (percent) => {
  if (percent > 90) return '#f56c6c'
  if (percent > 70) return '#e6a23c'
  return '#67c23a'
}

const formatBytes = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

const truncatePath = (path, maxLength) => {
  if (path.length <= maxLength) return path
  return '...' + path.slice(-maxLength + 3)
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

// API methods
const fetchDevices = async () => {
  try {
    const response = await axios.get('/api/storage/devices')
    allDevices.value = response.data.data || []
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
        fstabLoading: false
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
      zfsPoolName: ''
    }
    selectedDeviceInfo.value = null
  } catch (err) {
    error.value = 'Error loading devices'
    console.error('Error loading devices:', err)
  } finally {
    loading.value = false
  }
}

const mountDevice = async () => {
  try {
    mountLoading.value = true
    error.value = null
    
    if (!mountForm.value.device) {
      throw new Error('Please select a device')
    }
    
    const response = await axios.post('/api/storage/mount', {
      device: mountForm.value.device,
      mountPoint: mountForm.value.mountPoint,
      fsType: mountForm.value.fsType,
      options: mountForm.value.options,
      zfsPoolName: mountForm.value.zfsPoolName
    })

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
    ElNotification({
      title: 'Mount Error',
      message: error.value,
      type: 'error'
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
    
    // TODO: Implement actual partitioning API call
    ElNotification.success({
      title: 'Success',
      message: 'Partitions created successfully',
    })
    
    partitionDialogVisible.value = false
    await fetchDevices()
    await refreshFilesystems()
  } catch (error) {
    if (error === 'cancel') return
    ElNotification.error({
      title: 'Error',
      message: error.message,
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
      chunkSize: '128'
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
    
    // TODO: Implement actual RAID creation API call
    ElNotification.success({
      title: 'Success',
      message: `RAID ${raidForm.value.level} created successfully`,
      duration: 5000
    })
    
    raidDialogVisible.value = false
    await refreshFilesystems()
  } catch (error) {
    if (error === 'cancel') return
    ElNotification.error({
      title: 'RAID Error',
      message: error.message,
      duration: 0
    })
  } finally {
    raidLoading.value = false
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

const toggleFstabEntry = async (device, mountPoint, fsType, options, enabled) => {
  try {
    const response = await axios.post('/api/storage/fstab', {
      action: enabled ? 'add' : 'remove',
      device,
      mountPoint,
      fsType,
      options
    })
    
    if (response.data.success) {
      const fsIndex = filesystems.value.findIndex(fs => 
        fs.device === device && fs.mounted === mountPoint
      )
      
      if (fsIndex !== -1) {
        filesystems.value[fsIndex].inFstab = enabled
      }
      
      ElNotification.success({
        title: 'Success',
        message: response.data.message,
      })
      return true
    }
    return false
  } catch (error) {
    ElNotification.error({
      title: 'Error',
      message: error.response?.data?.details || error.message,
    })
    return false
  }
}

const debugDevices = async () => {
  try {
    debugDialogVisible.value = true
    
    const response = await axios.get('/api/storage/debug-devices')
    const allDevices = response.data.data || []
    
    const formattedDevices = allDevices.map(dev => ({
      path: `/dev/${dev.name}`,
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
      overlayDevices: overlayDevices
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
/* Reset and base styles */
.filesystems-widget {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

:deep(.el-card__header) {
  padding: 0;
  border-bottom: 1px solid #e4e7ed;
  background: #f8f9fa;
}

:deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

/* Header Styles */
.widget-header {
  padding: 20px 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  color: #409eff;
  background: rgba(64, 158, 255, 0.1);
  padding: 8px;
  border-radius: 8px;
}

.header-text {
  display: flex;
  flex-direction: column;
}

.header-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
}

.header-subtitle {
  margin: 4px 0 0;
  font-size: 14px;
  color: #909399;
  line-height: 1.4;
}

.header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.main-actions {
  display: flex;
  gap: 8px;
}

.main-actions :deep(.el-button) {
  padding: 8px 12px;
  border-radius: 6px;
  font-weight: 500;
}

.button-text {
  margin-left: 6px;
  font-size: 13px;
}

.tool-actions {
  display: flex;
  gap: 6px;
}

.tool-actions :deep(.el-button) {
  width: 36px;
  height: 36px;
}

/* Stats Container */
.stats-container {
  margin-top: 16px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  transition: all 0.3s ease;
  cursor: default;
}

.stat-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.1);
  transform: translateY(-2px);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(64, 158, 255, 0.1);
  border-radius: 8px;
  margin-right: 12px;
}

.stat-icon .iconify {
  color: #409eff;
}

.stat-details {
  flex: 1;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

/* Content Area - FIXED */
.widget-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  width: 100%;
}

.content-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

.table-container {
  flex: 1;
  overflow: auto;
  width: 100%;
  height: 100%;
  position: relative;
}

.filesystems-table {
  width: 100% !important;
  min-width: 100% !important;
  table-layout: auto !important;
  height: 100%;
}

.filesystems-table :deep(.el-table__header-wrapper) {
  background: #f5f7fa;
  position: sticky;
  top: 0;
  z-index: 2;
  width: 100% !important;
}

.filesystems-table :deep(.el-table__header) {
  width: 100% !important;
}

.filesystems-table :deep(.el-table__header th) {
  background: #f5f7fa;
  color: #606266;
  font-weight: 600;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  white-space: nowrap;
}

.filesystems-table :deep(.el-table__body-wrapper) {
  width: 100% !important;
  flex: 1;
}

.filesystems-table :deep(.el-table__body) {
  width: 100% !important;
}

.filesystems-table :deep(.el-table__row) {
  transition: background-color 0.3s ease;
  width: 100% !important;
}

.filesystems-table :deep(.el-table__row:hover) {
  background-color: #f5f7fa !important;
}

.filesystems-table :deep(.el-table__cell) {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  vertical-align: middle;
  white-space: nowrap;
}

.filesystems-table :deep(.el-table__empty-block) {
  width: 100% !important;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Table Cell Styles */
.device-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.device-tag {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
}

.device-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.device-path {
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-tags {
  flex-shrink: 0;
}

.fs-type {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mount-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mount-icon {
  color: #909399;
  flex-shrink: 0;
}

.mount-path {
  flex: 1;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.usage-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.usage-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.usage-percent {
  font-weight: 600;
  color: #303133;
}

.usage-size {
  color: #909399;
}

.usage-bar {
  margin: 0;
  width: 100%;
}

.usage-bar :deep(.el-progress-bar__outer) {
  border-radius: 4px;
  background-color: #ebeef5;
  width: 100%;
}

.usage-bar :deep(.el-progress-bar__inner) {
  border-radius: 4px;
  transition: width 0.6s ease;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
}

.status-text {
  font-size: 12px;
  text-transform: capitalize;
}

.read-only-badge {
  font-size: 10px;
  padding: 1px 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  margin-left: 4px;
}

.auto-mount-cell {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  width: 32px;
  height: 32px;
  padding: 0;
}

/* Empty State */
.empty-state {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  background: #ffffff;
  z-index: 1;
}

.empty-content {
  text-align: center;
  max-width: 400px;
}

.empty-icon {
  color: #dcdfe6;
  margin-bottom: 20px;
}

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 500;
  color: #303133;
}

.empty-state p {
  margin: 0 0 20px;
  font-size: 14px;
  color: #909399;
  line-height: 1.5;
}

/* Error State */
.error-state {
  padding: 20px;
  background: #ffffff;
}

/* Dialog Styles */
.storage-dialog :deep(.el-dialog) {
  border-radius: 12px;
  overflow: hidden;
  max-width: 90vw;
}

.storage-dialog :deep(.el-dialog__header) {
  padding: 20px 24px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  margin: 0;
}

.storage-dialog :deep(.el-dialog__title) {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.storage-dialog :deep(.el-dialog__body) {
  padding: 24px;
}

.storage-dialog :deep(.el-form-item__label) {
  font-weight: 500;
  color: #606266;
  padding-bottom: 8px;
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
  font-weight: 500;
  color: #303133;
  flex: 1;
}

.device-meta {
  font-size: 12px;
  color: #909399;
}

.device-info-card {
  background: #f8f9fa;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
}

.device-info-card h4 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-label {
  font-size: 13px;
  color: #606266;
  min-width: 80px;
}

.info-value {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
}

.fs-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.warning-section {
  margin: 16px 0;
}

.switch-label {
  margin-left: 8px;
  font-size: 13px;
  color: #606266;
}

/* Partition Dialog Specific */
.disk-usage-container {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.disk-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.disk-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.disk-stat-label {
  font-size: 13px;
  color: #6c757d;
}

.disk-stat-value {
  font-weight: 600;
  color: #2c3e50;
}

.disk-progress {
  margin: 8px 0;
}

.disk-percentage {
  text-align: center;
  font-size: 14px;
  color: #495057;
  margin-top: 8px;
}

.partitions-section {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.partition-list {
  margin-bottom: 16px;
}

.partition-item {
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.partition-item:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.partition-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.partition-number {
  font-weight: 600;
  color: #303133;
}

.partition-controls {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 12px;
  align-items: center;
}

.size-control {
  display: flex;
  gap: 8px;
}

.unit-select {
  width: 80px;
}

.type-control, .size-info {
  display: flex;
  align-items: center;
}

.size-info {
  font-size: 14px;
  color: #495057;
  min-width: 100px;
}

.add-partition-btn {
  width: 100%;
  margin-top: 8px;
}

/* RAID Info */
.raid-info-section {
  margin: 16px 0;
}

.info-card {
  background: #f8f9fa;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
}

.info-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2c3e50;
  font-weight: 600;
  margin-bottom: 12px;
}

.info-card-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-card-content p {
  margin: 0;
  color: #495057;
  line-height: 1.5;
  font-size: 14px;
}

.raid-stats {
  display: flex;
  gap: 24px;
  margin-top: 8px;
}

.raid-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.raid-stat-label {
  font-size: 13px;
  color: #6c757d;
}

.raid-stat-value {
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
}

.selection-info {
  font-size: 13px;
  color: #909399;
  margin-top: 8px;
}

/* Fstab Editor */
.code-dialog :deep(.el-dialog) {
  max-width: 900px;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.editor-info {
  display: flex;
  gap: 12px;
}

.line-count {
  font-size: 14px;
  color: #6c757d;
  font-family: 'Monaco', 'Menlo', monospace;
}

.code-editor {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 14px;
  line-height: 1.4;
}

.code-editor :deep(.el-textarea__inner) {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  white-space: pre;
  tab-size: 4;
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

/* Debug Dialog */
.debug-dialog :deep(.el-tabs__header) {
  background: #2c3e50;
  margin: 0;
}

.debug-dialog :deep(.el-tabs__item) {
  color: rgba(255, 255, 255, 0.8);
}

.debug-dialog :deep(.el-tabs__item.is-active) {
  color: white;
  font-weight: 500;
}

.tab-content {
  padding: 0;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e4e7ed;
}

.tab-header h4 {
  margin: 0;
  color: #2c3e50;
  font-weight: 600;
}

.device-path-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.debug-table {
  width: 100%;
}

.debug-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.debug-actions {
  display: flex;
  gap: 8px;
}

.debug-info {
  display: flex;
  gap: 12px;
}

.debug-timestamp {
  font-size: 14px;
  color: #6c757d;
}

/* Dialog Footer */
.storage-dialog :deep(.el-dialog__footer) {
  padding: 16px 24px;
  background: #f8f9fa;
  border-top: 1px solid #e4e7ed;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;
}

/* Spinner animation */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* Responsive Design */
@media (max-width: 1200px) {
  .header-content {
    flex-direction: column;
    gap: 16px;
  }
  
  .header-actions {
    width: 100%;
    align-items: stretch;
  }
  
  .main-actions {
    justify-content: center;
  }
  
  .tool-actions {
    justify-content: center;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .widget-header {
    padding: 16px;
  }
  
  .main-actions {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .partition-controls {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .raid-stats {
    flex-direction: column;
    gap: 12px;
  }
  
  .debug-footer {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .debug-info {
    justify-content: center;
  }
}

/* Hide less important columns on small screens */
@media (max-width: 1024px) {
  .filesystems-table :deep(.el-table__header-wrapper th:nth-child(5)),
  .filesystems-table :deep(.el-table__body-wrapper td:nth-child(5)) {
    display: none;
  }
}

@media (max-width: 768px) {
  .filesystems-table :deep(.el-table__header-wrapper th:nth-child(3)),
  .filesystems-table :deep(.el-table__body-wrapper td:nth-child(3)),
  .filesystems-table :deep(.el-table__header-wrapper th:nth-child(4)),
  .filesystems-table :deep(.el-table__body-wrapper td:nth-child(4)) {
    display: none;
  }
}

/* Custom scrollbar */
:deep(::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:deep(::-webkit-scrollbar-track) {
  background: #f1f1f1;
  border-radius: 4px;
}

:deep(::-webkit-scrollbar-thumb) {
  background: #c1c1c1;
  border-radius: 4px;
}

:deep(::-webkit-scrollbar-thumb:hover) {
  background: #a8a8a8;
}

/* Force table to take full width */
:deep(.el-table) {
  width: 100% !important;
}

:deep(.el-table__header) {
  width: 100% !important;
}

:deep(.el-table__body) {
  width: 100% !important;
}

/* Ensure table cells don't wrap unnecessarily */
.filesystems-table :deep(.el-table__cell) {
  max-width: none !important;
}

/* Fix for table header alignment */
.filesystems-table :deep(.el-table__header th .cell) {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
}

/* Make sure the table container fills available space */
.table-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.filesystems-table {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.filesystems-table :deep(.el-table__body-wrapper) {
  flex: 1;
}

/* Fix for fixed columns */
.filesystems-table :deep(.el-table__fixed),
.filesystems-table :deep(.el-table__fixed-right) {
  height: 100% !important;
}

/* Ensure proper column widths */
.filesystems-table :deep(.el-table__header colgroup col),
.filesystems-table :deep(.el-table__body colgroup col) {
  width: auto !important;
}

/* Table column auto sizing */
.filesystems-table :deep(.el-table__header-wrapper) {
  table-layout: auto !important;
}

.filesystems-table :deep(.el-table__body-wrapper) {
  table-layout: auto !important;
}

/* Warning dialog header */
.warning-dialog :deep(.el-dialog__header) {
  background: linear-gradient(90deg, #f56c6c, #e6a23c);
}

.warning-dialog :deep(.el-dialog__title) {
  color: white;
}

.warning-dialog :deep(.el-dialog__headerbtn .el-dialog__close) {
  color: white;
}

/* Fix for dropdown in table */
:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* =========================================== */
/* DARK MODE STYLES - CRITICAL FIX */
/* =========================================== */

/* Root level dark mode */
:root.dark .filesystems-widget,
.dark-mode .filesystems-widget,
[data-theme="dark"] .filesystems-widget {
  background: #1a1a1a !important;
  color: #e0e0e0 !important;
  border-color: #333 !important;
}

:root.dark .filesystems-widget :deep(.el-card__header),
.dark-mode .filesystems-widget :deep(.el-card__header),
[data-theme="dark"] .filesystems-widget :deep(.el-card__header) {
  background: #2d2d2d !important;
  border-bottom-color: #404040 !important;
}

:root.dark .filesystems-widget .header-title,
.dark-mode .filesystems-widget .header-title,
[data-theme="dark"] .filesystems-widget .header-title {
  color: #ffffff !important;
}

:root.dark .filesystems-widget .header-subtitle,
.dark-mode .filesystems-widget .header-subtitle,
[data-theme="dark"] .filesystems-widget .header-subtitle {
  color: #b0b0b0 !important;
}

:root.dark .filesystems-widget .stat-card,
.dark-mode .filesystems-widget .stat-card,
[data-theme="dark"] .filesystems-widget .stat-card {
  background: #2d2d2d !important;
  border-color: #404040 !important;
  color: #e0e0e0 !important;
}

:root.dark .filesystems-widget .stat-card:hover,
.dark-mode .filesystems-widget .stat-card:hover,
[data-theme="dark"] .filesystems-widget .stat-card:hover {
  border-color: #409eff !important;
  background: #363636 !important;
}

:root.dark .filesystems-widget .stat-value,
.dark-mode .filesystems-widget .stat-value,
[data-theme="dark"] .filesystems-widget .stat-value {
  color: #ffffff !important;
}

:root.dark .filesystems-widget .stat-label,
.dark-mode .filesystems-widget .stat-label,
[data-theme="dark"] .filesystems-widget .stat-label {
  color: #b0b0b0 !important;
}

/* Table in dark mode */
:root.dark .filesystems-widget :deep(.el-table),
.dark-mode .filesystems-widget :deep(.el-table),
[data-theme="dark"] .filesystems-widget :deep(.el-table) {
  background: #1a1a1a !important;
  color: #e0e0e0 !important;
}

:root.dark .filesystems-widget :deep(.el-table__header-wrapper),
.dark-mode .filesystems-widget :deep(.el-table__header-wrapper),
[data-theme="dark"] .filesystems-widget :deep(.el-table__header-wrapper) {
  background: #2d2d2d !important;
}

:root.dark .filesystems-widget :deep(.el-table__header th),
.dark-mode .filesystems-widget :deep(.el-table__header th),
[data-theme="dark"] .filesystems-widget :deep(.el-table__header th) {
  background: #2d2d2d !important;
  color: #ffffff !important;
  border-bottom-color: #404040 !important;
}

:root.dark .filesystems-widget :deep(.el-table__row),
.dark-mode .filesystems-widget :deep(.el-table__row),
[data-theme="dark"] .filesystems-widget :deep(.el-table__row) {
  background: #1a1a1a !important;
  color: #e0e0e0 !important;
}

:root.dark .filesystems-widget :deep(.el-table__row:hover),
.dark-mode .filesystems-widget :deep(.el-table__row:hover),
[data-theme="dark"] .filesystems-widget :deep(.el-table__row:hover) {
  background: #2d2d2d !important;
}

:root.dark .filesystems-widget :deep(.el-table__cell),
.dark-mode .filesystems-widget :deep(.el-table__cell),
[data-theme="dark"] .filesystems-widget :deep(.el-table__cell) {
  background: #1a1a1a !important;
  color: #e0e0e0 !important;
  border-bottom-color: #404040 !important;
}

/* Table cell content in dark mode */
:root.dark .filesystems-widget .device-path,
.dark-mode .filesystems-widget .device-path,
[data-theme="dark"] .filesystems-widget .device-path {
  color: #b0b0b0 !important;
}

:root.dark .filesystems-widget .mount-path,
.dark-mode .filesystems-widget .mount-path,
[data-theme="dark"] .filesystems-widget .mount-path {
  color: #ffffff !important;
}

:root.dark .filesystems-widget .usage-percent,
.dark-mode .filesystems-widget .usage-percent,
[data-theme="dark"] .filesystems-widget .usage-percent {
  color: #ffffff !important;
}

:root.dark .filesystems-widget .usage-size,
.dark-mode .filesystems-widget .usage-size,
[data-theme="dark"] .filesystems-widget .usage-size {
  color: #b0b0b0 !important;
}

:root.dark .filesystems-widget .empty-state,
.dark-mode .filesystems-widget .empty-state,
[data-theme="dark"] .filesystems-widget .empty-state {
  background: #1a1a1a !important;
}

:root.dark .filesystems-widget .empty-state h3,
.dark-mode .filesystems-widget .empty-state h3,
[data-theme="dark"] .filesystems-widget .empty-state h3 {
  color: #ffffff !important;
}

:root.dark .filesystems-widget .empty-state p,
.dark-mode .filesystems-widget .empty-state p,
[data-theme="dark"] .filesystems-widget .empty-state p {
  color: #b0b0b0 !important;
}

/* Dialogs in dark mode */
:root.dark .storage-dialog :deep(.el-dialog),
.dark-mode .storage-dialog :deep(.el-dialog),
[data-theme="dark"] .storage-dialog :deep(.el-dialog) {
  background: #2d2d2d !important;
  color: #e0e0e0 !important;
}

:root.dark .storage-dialog :deep(.el-dialog__header),
.dark-mode .storage-dialog :deep(.el-dialog__header),
[data-theme="dark"] .storage-dialog :deep(.el-dialog__header) {
  background: #363636 !important;
  border-bottom-color: #404040 !important;
}

:root.dark .storage-dialog :deep(.el-dialog__title),
.dark-mode .storage-dialog :deep(.el-dialog__title),
[data-theme="dark"] .storage-dialog :deep(.el-dialog__title) {
  color: #ffffff !important;
}

:root.dark .storage-dialog :deep(.el-form-item__label),
.dark-mode .storage-dialog :deep(.el-form-item__label),
[data-theme="dark"] .storage-dialog :deep(.el-form-item__label) {
  color: #d0d0d0 !important;
}

:root.dark .storage-dialog .device-info-card,
.dark-mode .storage-dialog .device-info-card,
[data-theme="dark"] .storage-dialog .device-info-card {
  background: #363636 !important;
  border-color: #404040 !important;
  color: #e0e0e0 !important;
}

:root.dark .storage-dialog .info-label,
.dark-mode .storage-dialog .info-label,
[data-theme="dark"] .storage-dialog .info-label {
  color: #b0b0b0 !important;
}

:root.dark .storage-dialog .info-value,
.dark-mode .storage-dialog .info-value,
[data-theme="dark"] .storage-dialog .info-value {
  color: #ffffff !important;
}

/* Progress bars in dark mode */
:root.dark .usage-bar :deep(.el-progress-bar__outer),
.dark-mode .usage-bar :deep(.el-progress-bar__outer),
[data-theme="dark"] .usage-bar :deep(.el-progress-bar__outer) {
  background-color: #363636 !important;
}

/* Empty icon in dark mode */
:root.dark .empty-icon,
.dark-mode .empty-icon,
[data-theme="dark"] .empty-icon {
  color: #404040 !important;
}

/* Card borders in dark mode */
:root.dark .filesystems-widget,
.dark-mode .filesystems-widget,
[data-theme="dark"] .filesystems-widget {
  border: 1px solid #404040 !important;
}

/* Stats container border in dark mode */
:root.dark .stats-container,
.dark-mode .stats-container,
[data-theme="dark"] .stats-container {
  border-top-color: #404040 !important;
}

/* Icon colors in dark mode */
:root.dark .header-icon,
.dark-mode .header-icon,
[data-theme="dark"] .header-icon {
  background: rgba(64, 158, 255, 0.2) !important;
  color: #409eff !important;
}

/* Mount icon in dark mode */
:root.dark .mount-icon,
.dark-mode .mount-icon,
[data-theme="dark"] .mount-icon {
  color: #b0b0b0 !important;
}

/* Status text in dark mode */
:root.dark .status-text,
.dark-mode .status-text,
[data-theme="dark"] .status-text {
  color: inherit !important;
}

/* Error state in dark mode */
:root.dark .error-state,
.dark-mode .error-state,
[data-theme="dark"] .error-state {
  background: #1a1a1a !important;
}

/* Dialog footer in dark mode */
:root.dark .storage-dialog :deep(.el-dialog__footer),
.dark-mode .storage-dialog :deep(.el-dialog__footer),
[data-theme="dark"] .storage-dialog :deep(.el-dialog__footer) {
  background: #363636 !important;
  border-top-color: #404040 !important;
}

/* Fstab editor in dark mode */
:root.dark .code-editor :deep(.el-textarea__inner),
.dark-mode .code-editor :deep(.el-textarea__inner),
[data-theme="dark"] .code-editor :deep(.el-textarea__inner) {
  background: #1a1a1a !important;
  color: #e0e0e0 !important;
  border-color: #404040 !important;
}

/* Debug dialog tabs in dark mode */
:root.dark .debug-dialog :deep(.el-tabs__header),
.dark-mode .debug-dialog :deep(.el-tabs__header),
[data-theme="dark"] .debug-dialog :deep(.el-tabs__header) {
  background: #2d2d2d !important;
}

:root.dark .debug-dialog :deep(.el-tabs__item),
.dark-mode .debug-dialog :deep(.el-tabs__item),
[data-theme="dark"] .debug-dialog :deep(.el-tabs__item) {
  color: rgba(255, 255, 255, 0.8) !important;
}

:root.dark .debug-dialog :deep(.el-tabs__item.is-active),
.dark-mode .debug-dialog :deep(.el-tabs__item.is-active),
[data-theme="dark"] .debug-dialog :deep(.el-tabs__item.is-active) {
  color: white !important;
  background: #1a1a1a !important;
}

/* Tab header in dark mode */
:root.dark .tab-header,
.dark-mode .tab-header,
[data-theme="dark"] .tab-header {
  background: #2d2d2d !important;
  border-bottom-color: #404040 !important;
}

:root.dark .tab-header h4,
.dark-mode .tab-header h4,
[data-theme="dark"] .tab-header h4 {
  color: #ffffff !important;
}

/* Debug table in dark mode */
:root.dark .debug-table :deep(.el-table),
.dark-mode .debug-table :deep(.el-table),
[data-theme="dark"] .debug-table :deep(.el-table) {
  background: #1a1a1a !important;
}

:root.dark .debug-table :deep(.el-table__header-wrapper),
.dark-mode .debug-table :deep(.el-table__header-wrapper),
[data-theme="dark"] .debug-table :deep(.el-table__header-wrapper) {
  background: #2d2d2d !important;
}

:root.dark .debug-table :deep(.el-table__header th),
.dark-mode .debug-table :deep(.el-table__header th),
[data-theme="dark"] .debug-table :deep(.el-table__header th) {
  background: #2d2d2d !important;
  color: #ffffff !important;
}

/* Scrollbar in dark mode */
:root.dark :deep(::-webkit-scrollbar-track),
.dark-mode :deep(::-webkit-scrollbar-track),
[data-theme="dark"] :deep(::-webkit-scrollbar-track) {
  background: #2d2d2d !important;
}

:root.dark :deep(::-webkit-scrollbar-thumb),
.dark-mode :deep(::-webkit-scrollbar-thumb),
[data-theme="dark"] :deep(::-webkit-scrollbar-thumb) {
  background: #404040 !important;
}

:root.dark :deep(::-webkit-scrollbar-thumb:hover),
.dark-mode :deep(::-webkit-scrollbar-thumb:hover),
[data-theme="dark"] :deep(::-webkit-scrollbar-thumb:hover) {
  background: #505050 !important;
}

/* Disabled state in dark mode */
:root.dark :deep(.el-button.is-disabled),
.dark-mode :deep(.el-button.is-disabled),
[data-theme="dark"] :deep(.el-button.is-disabled) {
  background: #363636 !important;
  border-color: #404040 !important;
  color: #808080 !important;
}

/* Loading spinner in dark mode */
:root.dark .spin,
.dark-mode .spin,
[data-theme="dark"] .spin {
  color: #409eff !important;
}

/* Form inputs in dark mode */
:root.dark :deep(.el-input__inner),
.dark-mode :deep(.el-input__inner),
[data-theme="dark"] :deep(.el-input__inner) {
  background: #2d2d2d !important;
  border-color: #404040 !important;
  color: #e0e0e0 !important;
}

:root.dark :deep(.el-input__inner::placeholder),
.dark-mode :deep(.el-input__inner::placeholder),
[data-theme="dark"] :deep(.el-input__inner::placeholder) {
  color: #808080 !important;
}

/* Select dropdown in dark mode */
:root.dark :deep(.el-select-dropdown),
.dark-mode :deep(.el-select-dropdown),
[data-theme="dark"] :deep(.el-select-dropdown) {
  background: #2d2d2d !important;
  border-color: #404040 !important;
}

:root.dark :deep(.el-select-dropdown__item),
.dark-mode :deep(.el-select-dropdown__item),
[data-theme="dark"] :deep(.el-select-dropdown__item) {
  color: #e0e0e0 !important;
}

:root.dark :deep(.el-select-dropdown__item.hover),
.dark-mode :deep(.el-select-dropdown__item.hover),
[data-theme="dark"] :deep(.el-select-dropdown__item.hover),
:root.dark :deep(.el-select-dropdown__item:hover),
.dark-mode :deep(.el-select-dropdown__item:hover),
[data-theme="dark"] :deep(.el-select-dropdown__item:hover) {
  background: #363636 !important;
}

/* Switch in dark mode */
:root.dark :deep(.el-switch__core),
.dark-mode :deep(.el-switch__core),
[data-theme="dark"] :deep(.el-switch__core) {
  background: #404040 !important;
  border-color: #505050 !important;
}

/* Button default in dark mode */
:root.dark :deep(.el-button--default),
.dark-mode :deep(.el-button--default),
[data-theme="dark"] :deep(.el-button--default) {
  background: #363636 !important;
  border-color: #404040 !important;
  color: #e0e0e0 !important;
}

:root.dark :deep(.el-button--default:hover),
.dark-mode :deep(.el-button--default:hover),
[data-theme="dark"] :deep(.el-button--default:hover) {
  background: #404040 !important;
  border-color: #505050 !important;
}

/* Button primary in dark mode */
:root.dark :deep(.el-button--primary),
.dark-mode :deep(.el-button--primary),
[data-theme="dark"] :deep(.el-button--primary) {
  background: #409eff !important;
  border-color: #409eff !important;
}

:root.dark :deep(.el-button--primary:hover),
.dark-mode :deep(.el-button--primary:hover),
[data-theme="dark"] :deep(.el-button--primary:hover) {
  background: #66b1ff !important;
  border-color: #66b1ff !important;
}

/* Button danger in dark mode */
:root.dark :deep(.el-button--danger),
.dark-mode :deep(.el-button--danger),
[data-theme="dark"] :deep(.el-button--danger) {
  background: #f56c6c !important;
  border-color: #f56c6c !important;
}

:root.dark :deep(.el-button--danger:hover),
.dark-mode :deep(.el-button--danger:hover),
[data-theme="dark"] :deep(.el-button--danger:hover) {
  background: #f78989 !important;
  border-color: #f78989 !important;
}

/* Button warning in dark mode */
:root.dark :deep(.el-button--warning),
.dark-mode :deep(.el-button--warning),
[data-theme="dark"] :deep(.el-button--warning) {
  background: #e6a23c !important;
  border-color: #e6a23c !important;
}

:root.dark :deep(.el-button--warning:hover),
.dark-mode :deep(.el-button--warning:hover),
[data-theme="dark"] :deep(.el-button--warning:hover) {
  background: #ebb563 !important;
  border-color: #ebb563 !important;
}

/* Button plain in dark mode */
:root.dark :deep(.el-button.is-plain),
.dark-mode :deep(.el-button.is-plain),
[data-theme="dark"] :deep(.el-button.is-plain) {
  background: transparent !important;
  border-color: #404040 !important;
  color: #e0e0e0 !important;
}

:root.dark :deep(.el-button.is-plain:hover),
.dark-mode :deep(.el-button.is-plain:hover),
[data-theme="dark"] :deep(.el-button.is-plain:hover) {
  background: #363636 !important;
  border-color: #505050 !important;
}
</style>
