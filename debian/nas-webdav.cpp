#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <filesystem>
#include <map>
#include <unordered_map>
#include <nlohmann/json.hpp>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <cstring>
#include <cerrno>
#include <sstream>
#include <algorithm>

using json = nlohmann::json;
namespace fs = std::filesystem;

struct ShareConfig {
    std::string path;
    std::string alias;
    bool read_only;
};

struct WebDAVConfig {
    int port;
    std::vector<ShareConfig> shares;
};

WebDAVConfig load_config(const std::string& config_path) {
    std::ifstream config_file(config_path);
    if (!config_file.is_open()) {
        throw std::runtime_error("Cannot open config file");
    }

    json config_json;
    config_file >> config_json;

    WebDAVConfig config;
    config.port = config_json.value("port", 8080);

    for (const auto& share : config_json["shares"]) {
        config.shares.push_back({
            share["path"],
            share["alias"],
            share.value("read_only", false)
        });
    }

    return config;
}

std::string get_mime_type(const std::string& filename) {
    static const std::unordered_map<std::string, std::string> mime_types = {
        {".txt", "text/plain"},
        {".html", "text/html"},
        {".htm", "text/html"},
        {".css", "text/css"},
        {".js", "application/javascript"},
        {".json", "application/json"},
        {".jpg", "image/jpeg"},
        {".jpeg", "image/jpeg"},
        {".png", "image/png"},
        {".gif", "image/gif"},
        {".pdf", "application/pdf"},
        {".zip", "application/zip"},
        {".tar", "application/x-tar"},
        {".gz", "application/gzip"},
        {".mp3", "audio/mpeg"},
        {".mp4", "video/mp4"},
        {".avi", "video/x-msvideo"},
        {".doc", "application/msword"},
        {".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
        {".xls", "application/vnd.ms-excel"},
        {".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
        {".ppt", "application/vnd.ms-powerpoint"},
        {".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"},
        {".odt", "application/vnd.oasis.opendocument.text"},
        {".ods", "application/vnd.oasis.opendocument.spreadsheet"},
        {".odp", "application/vnd.oasis.opendocument.presentation"},
        {".svg", "image/svg+xml"},
        {".xml", "application/xml"},
        {".csv", "text/csv"},
        {".rtf", "application/rtf"},
        {"", "application/octet-stream"},
        {".", "application/octet-stream"}
    };

    std::string ext = fs::path(filename).extension().string();
    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
    
    auto it = mime_types.find(ext);
    return it != mime_types.end() ? it->second : "application/octet-stream";
}

std::string get_webdav_options_response() {
    return "HTTP/1.1 200 OK\r\n"
           "DAV: 1,2\r\n"
           "Allow: OPTIONS, GET, HEAD, POST, PUT, DELETE, PROPFIND\r\n"
           "Content-Length: 0\r\n"
           "Connection: keep-alive\r\n\r\n";
}

std::string generate_propfind_xml(const std::string& href, const fs::path& full_path) {
    std::ostringstream xml;
    bool is_dir = fs::is_directory(full_path);
    std::string display_name = full_path.filename().string();

    xml << "<d:response xmlns:d=\"DAV:\">\n"
        << "  <d:href>" << href << "</d:href>\n"
        << "  <d:propstat>\n"
        << "    <d:prop>\n"
        << "      <d:displayname>" << display_name << "</d:displayname>\n"
        << "      <d:resourcetype>"
        << (is_dir ? "<d:collection/>" : "")
        << "</d:resourcetype>\n";

    if (!is_dir) {
        xml << "      <d:getcontentlength>" << fs::file_size(full_path) << "</d:getcontentlength>\n"
            << "      <d:getcontenttype>" << get_mime_type(full_path.string()) << "</d:getcontenttype>\n";
    }

    xml << "    </d:prop>\n"
        << "    <d:status>HTTP/1.1 200 OK</d:status>\n"
        << "  </d:propstat>\n"
        << "</d:response>\n";

    return xml.str();
}

std::string get_webdav_propfind_response(const std::string& path, const WebDAVConfig& config) {
    std::ostringstream xml;
    xml << "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"
        << "<d:multistatus xmlns:d=\"DAV:\">\n";

    try {
        // Normalizacja ścieżki WebDAV
        std::string dav_path = path;
        if (dav_path.empty()) dav_path = "/";
        
        // Sprawdź czy to katalog i dodaj / na końcu jeśli potrzeba
        if (dav_path.back() != '/') {
            for (const auto& share : config.shares) {
                if (dav_path == "/" + share.alias) {
                    dav_path += "/";
                    break;
                }
                if (dav_path.find("/" + share.alias + "/") == 0) {
                    std::string relative_path = dav_path.substr(share.alias.length() + 2);
                    fs::path full_path = fs::path(share.path) / relative_path;
                    if (fs::is_directory(full_path)) {
                        dav_path += "/";
                    }
                    break;
                }
            }
        }

        if (dav_path == "/") {
            // Katalog główny WebDAV
            xml << generate_propfind_xml("/", fs::path("/"));

            // Lista udziałów
            for (const auto& share : config.shares) {
                xml << generate_propfind_xml("/" + share.alias + "/", fs::path(share.path));
            }
        } else {
            // Obsługa konkretnego udziału
            for (const auto& share : config.shares) {
                if (dav_path.find("/" + share.alias + "/") == 0 || dav_path == "/" + share.alias + "/") {
                    std::string relative_path = dav_path.substr(share.alias.length() + 2);
                    fs::path full_path = fs::path(share.path) / relative_path;

                    if (!fs::exists(full_path)) {
                        return "HTTP/1.1 404 Not Found\r\n\r\n";
                    }

                    // Bieżący katalog
                    xml << generate_propfind_xml(dav_path, full_path);

                    // Zawartość katalogu
                    if (fs::is_directory(full_path)) {
                        for (const auto& entry : fs::directory_iterator(full_path)) {
                            std::string entry_name = entry.path().filename().string();
                            std::string entry_href = dav_path;
                            if (entry_href.back() != '/') entry_href += "/";
                            entry_href += entry_name;
                            if (entry.is_directory()) entry_href += "/";
                            xml << generate_propfind_xml(entry_href, entry.path());
                        }
                    }
                    break;
                }
            }
        }
    } catch (const fs::filesystem_error& e) {
        std::cerr << "Filesystem error: " << e.what() << std::endl;
        return "HTTP/1.1 500 Internal Server Error\r\n\r\n";
    }

    xml << "</d:multistatus>";

    std::ostringstream response;
    response << "HTTP/1.1 207 Multi-Status\r\n"
             << "Content-Type: application/xml; charset=\"utf-8\"\r\n"
             << "Content-Length: " << xml.str().length() << "\r\n"
             << "Connection: keep-alive\r\n\r\n"
             << xml.str();

    return response.str();
}

std::string handle_get_request(const std::string& request, const WebDAVConfig& config) {
    size_t start = request.find(' ') + 1;
    size_t end = request.find(' ', start);
    std::string path = request.substr(start, end - start);

    for (const auto& share : config.shares) {
        if (path.find("/" + share.alias) == 0) {
            std::string relative_path = path.substr(share.alias.length() + 1);
            fs::path full_path = fs::path(share.path) / relative_path;

            if (!fs::exists(full_path)) {
                return "HTTP/1.1 404 Not Found\r\n\r\n";
            }

            if (fs::is_directory(full_path)) {
                return get_webdav_propfind_response(path, config);
            }

            std::ifstream file(full_path, std::ios::binary);
            if (!file) {
                return "HTTP/1.1 403 Forbidden\r\n\r\n";
            }

            std::string content((std::istreambuf_iterator<char>(file)), 
                        std::istreambuf_iterator<char>());

            std::ostringstream response;
            response << "HTTP/1.1 200 OK\r\n"
                     << "Content-Type: " << get_mime_type(full_path.string()) << "\r\n"
                     << "Content-Length: " << content.size() << "\r\n"
                     << "Connection: keep-alive\r\n\r\n"
                     << content;

            return response.str();
        }
    }

    return "HTTP/1.1 404 Not Found\r\n\r\n";
}

void handle_client(int client_fd, const WebDAVConfig& config) {
    char buffer[8192] = {0};
    ssize_t bytes_read = read(client_fd, buffer, sizeof(buffer) - 1);
    
    if (bytes_read <= 0) {
        close(client_fd);
        return;
    }

    std::string request(buffer, bytes_read);
    std::string response;

    // Log request for debugging
    std::cerr << "Request:\n" << request << "\n---\n";

    if (request.find("OPTIONS ") == 0) {
        response = get_webdav_options_response();
    } 
    else if (request.find("PROPFIND ") == 0) {
        size_t start = request.find(' ') + 1;
        size_t end = request.find(' ', start);
        std::string path = request.substr(start, end - start);
        response = get_webdav_propfind_response(path, config);
    }
    else if (request.find("GET ") == 0) {
        response = handle_get_request(request, config);
    }
    else {
        response = "HTTP/1.1 501 Not Implemented\r\n\r\n";
    }

    // Log response for debugging
    std::cerr << "Response:\n" << response << "\n---\n";

    send(client_fd, response.c_str(), response.size(), 0);
    close(client_fd);
}

void start_server(const WebDAVConfig& config) {
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) {
        throw std::runtime_error("Socket creation failed");
    }

    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(config.port);

    if (bind(server_fd, (struct sockaddr*)&address, sizeof(address)) < 0) {
        close(server_fd);
        throw std::runtime_error("Bind failed");
    }

    if (listen(server_fd, 5) < 0) {
        close(server_fd);
        throw std::runtime_error("Listen failed");
    }

    std::cout << "Server started on port " << config.port << std::endl;

    while (true) {
        sockaddr_in client_addr{};
        socklen_t client_len = sizeof(client_addr);
        int client_fd = accept(server_fd, (struct sockaddr*)&client_addr, &client_len);

        if (client_fd < 0) {
            std::cerr << "Accept error" << std::endl;
            continue;
        }

        handle_client(client_fd, config);
    }
}

int main() {
    try {
        WebDAVConfig config = load_config("/etc/nas-panel/webdav.conf");
        start_server(config);
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
    return 0;
}
