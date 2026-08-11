-- CreateTable
CREATE TABLE `collected_equipment_report_evidences` (
    `report_id` VARCHAR(36) NOT NULL,
    `evidence_id` VARCHAR(36) NOT NULL,

    PRIMARY KEY (`report_id`, `evidence_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `collected_equipment_report_evidences` ADD CONSTRAINT `collected_equipment_report_evidences_report_id_fkey` FOREIGN KEY (`report_id`) REFERENCES `collected_equipment_reports`(`report_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collected_equipment_report_evidences` ADD CONSTRAINT `collected_equipment_report_evidences_evidence_id_fkey` FOREIGN KEY (`evidence_id`) REFERENCES `evidences`(`evidence_id`) ON DELETE CASCADE ON UPDATE CASCADE;
