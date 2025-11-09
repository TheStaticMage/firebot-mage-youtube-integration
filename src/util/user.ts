export function youTubeifyUserId(userId: string | number | undefined): string {
    if (userId === undefined || userId === null) {
        return "";
    }
    return String(userId).startsWith("y") ? String(userId) : `y${userId}`;
}

export function unYouTubeifyUserId(userId: string | number | undefined): string {
    if (userId === undefined || userId === null) {
        return "";
    }
    return String(userId).startsWith("y") ? String(userId).substring(1) : String(userId);
}

export function youTubeifyUsername(username: string | undefined): string {
    if (!username) {
        return "";
    }
    let result = username.endsWith("@youtube") ? username : `${username}@youtube`;
    if (result.startsWith("@")) {
        result = result.substring(1);
    }
    return result;
}

export function unYouTubeifyUsername(username: string | undefined): string {
    if (!username) {
        return "";
    }
    let result = username.endsWith("@youtube") ? username.substring(0, username.length - 8) : username;
    if (result.startsWith("@")) {
        result = result.substring(1);
    }
    return result;
}

export function parseDate(dateString: string | undefined | null): Date | undefined {
    if (!dateString || dateString === null || dateString === undefined) {
        return undefined;
    }

    if (dateString === "0001-01-01T00:00:00Z") {
        return undefined;
    }

    const date = new Date(dateString);
    return isNaN(date.getTime()) ? undefined : date;
}

export function userIdToCleanString(userId: string | number = ""): string {
    if (typeof userId === "number") {
        return userId > 0 ? userId.toString() : "";
    }
    const unYouTubeifiedUserId = unYouTubeifyUserId(userId);
    return unYouTubeifiedUserId.trim() !== "" ? unYouTubeifiedUserId : "";
}
