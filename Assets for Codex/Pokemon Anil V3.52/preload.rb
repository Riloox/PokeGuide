# Fix for Zlib::StreamError/Zlib:DataError by [ g f y ]
module Zlib
  class Inflate
    def self.inflate(string)
      MKXP.zinflate(string)
    end
  end

  class Deflate
    def self.deflate(string, level = 0)
      MKXP.zdeflate(string)
    end
  end
end
