CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`phone` text,
	`expires` integer NOT NULL,
	`offer` text,
	`answer` text,
	`input` text,
	`status` text
);
