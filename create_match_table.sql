-- Criar tabela match para sistema de relacionamento estilo Tinder
CREATE TABLE IF NOT EXISTS `match` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `senderId` INT NOT NULL COMMENT 'Usuário que deu o primeiro like',
  `receiverId` INT NOT NULL COMMENT 'Usuário que recebeu o primeiro like',
  `eventId` INT NOT NULL COMMENT 'Evento onde o match aconteceu',
  `senderMatch` TINYINT NOT NULL DEFAULT 1 COMMENT '0 = removeu match, 1 = deu match',
  `receiverMatch` TINYINT NOT NULL DEFAULT 0 COMMENT '0 = não deu match ainda, 1 = deu match de volta',
  `matchedAt` DATETIME NULL COMMENT 'Data quando ambos deram match (match mútuo)',
  `situation` TINYINT NOT NULL DEFAULT 1 COMMENT '0 = deletado/desfeito, 1 = ativo',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NULL,
  `deletedAt` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `match_unique` (`senderId`, `receiverId`, `eventId`),
  INDEX `match_sender_FK` (`senderId`),
  INDEX `match_receiver_FK` (`receiverId`),
  INDEX `match_event_FK` (`eventId`),
  INDEX `match_matchedAt_IDX` (`matchedAt`),
  INDEX `match_situation_IDX` (`situation`),
  CONSTRAINT `match_sender_FK` FOREIGN KEY (`senderId`) REFERENCES `client` (`id`) ON UPDATE RESTRICT,
  CONSTRAINT `match_receiver_FK` FOREIGN KEY (`receiverId`) REFERENCES `client` (`id`) ON UPDATE RESTRICT,
  CONSTRAINT `match_event_FK` FOREIGN KEY (`eventId`) REFERENCES `events` (`id`) ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
