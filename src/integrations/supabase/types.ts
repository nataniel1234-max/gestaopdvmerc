export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      caixas: {
        Row: {
          aberto_em: string
          created_at: string
          diferenca: number | null
          fechado_em: string | null
          id: string
          observacoes_abertura: string | null
          observacoes_fechamento: string | null
          operador: string | null
          qtd_vendas: number
          status: string
          total_credito: number
          total_debito: number
          total_despesas: number
          total_dinheiro: number
          total_fiado: number
          total_pix: number
          total_recebimentos_fiado: number
          total_sangrias: number
          total_suprimentos: number
          updated_at: string
          valor_abertura: number
          valor_fechamento_calculado: number | null
          valor_fechamento_informado: number | null
        }
        Insert: {
          aberto_em?: string
          created_at?: string
          diferenca?: number | null
          fechado_em?: string | null
          id?: string
          observacoes_abertura?: string | null
          observacoes_fechamento?: string | null
          operador?: string | null
          qtd_vendas?: number
          status?: string
          total_credito?: number
          total_debito?: number
          total_despesas?: number
          total_dinheiro?: number
          total_fiado?: number
          total_pix?: number
          total_recebimentos_fiado?: number
          total_sangrias?: number
          total_suprimentos?: number
          updated_at?: string
          valor_abertura?: number
          valor_fechamento_calculado?: number | null
          valor_fechamento_informado?: number | null
        }
        Update: {
          aberto_em?: string
          created_at?: string
          diferenca?: number | null
          fechado_em?: string | null
          id?: string
          observacoes_abertura?: string | null
          observacoes_fechamento?: string | null
          operador?: string | null
          qtd_vendas?: number
          status?: string
          total_credito?: number
          total_debito?: number
          total_despesas?: number
          total_dinheiro?: number
          total_fiado?: number
          total_pix?: number
          total_recebimentos_fiado?: number
          total_sangrias?: number
          total_suprimentos?: number
          updated_at?: string
          valor_abertura?: number
          valor_fechamento_calculado?: number | null
          valor_fechamento_informado?: number | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean
          created_at: string
          documento: string | null
          email: string | null
          endereco: string | null
          id: string
          limite_credito: number
          nome: string
          observacoes: string | null
          permite_fiado: boolean
          saldo_devedor: number
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          limite_credito?: number
          nome: string
          observacoes?: string | null
          permite_fiado?: boolean
          saldo_devedor?: number
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          limite_credito?: number
          nome?: string
          observacoes?: string | null
          permite_fiado?: boolean
          saldo_devedor?: number
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      itens_nota_entrada: {
        Row: {
          id: string
          nota_id: string
          preco_custo_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Insert: {
          id?: string
          nota_id: string
          preco_custo_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Update: {
          id?: string
          nota_id?: string
          preco_custo_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_nota_entrada_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "notas_entrada"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_nota_entrada_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_venda: {
        Row: {
          id: string
          preco_unitario: number
          produto_id: string
          produto_nome: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Insert: {
          id?: string
          preco_unitario: number
          produto_id: string
          produto_nome: string
          quantidade: number
          subtotal: number
          venda_id: string
        }
        Update: {
          id?: string
          preco_unitario?: number
          produto_id?: string
          produto_nome?: string
          quantidade?: number
          subtotal?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_venda_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_venda_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_caixa: {
        Row: {
          caixa_id: string
          created_at: string
          descricao: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          referencia_id: string | null
          tipo: Database["public"]["Enums"]["tipo_mov_caixa"]
          valor: number
        }
        Insert: {
          caixa_id: string
          created_at?: string
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          referencia_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_mov_caixa"]
          valor: number
        }
        Update: {
          caixa_id?: string
          created_at?: string
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          referencia_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_mov_caixa"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_caixa_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          custo_unitario: number | null
          estoque_anterior: number
          estoque_novo: number
          id: string
          motivo: Database["public"]["Enums"]["movimentacao_motivo"]
          observacoes: string | null
          produto_id: string
          quantidade: number
          referencia_id: string | null
          tipo: Database["public"]["Enums"]["movimentacao_tipo"]
        }
        Insert: {
          created_at?: string
          custo_unitario?: number | null
          estoque_anterior: number
          estoque_novo: number
          id?: string
          motivo: Database["public"]["Enums"]["movimentacao_motivo"]
          observacoes?: string | null
          produto_id: string
          quantidade: number
          referencia_id?: string | null
          tipo: Database["public"]["Enums"]["movimentacao_tipo"]
        }
        Update: {
          created_at?: string
          custo_unitario?: number | null
          estoque_anterior?: number
          estoque_novo?: number
          id?: string
          motivo?: Database["public"]["Enums"]["movimentacao_motivo"]
          observacoes?: string | null
          produto_id?: string
          quantidade?: number
          referencia_id?: string | null
          tipo?: Database["public"]["Enums"]["movimentacao_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_entrada: {
        Row: {
          created_at: string
          data_entrada: string
          fornecedor_id: string | null
          id: string
          numero_nota: string | null
          observacoes: string | null
          valor_total: number
        }
        Insert: {
          created_at?: string
          data_entrada?: string
          fornecedor_id?: string | null
          id?: string
          numero_nota?: string | null
          observacoes?: string | null
          valor_total?: number
        }
        Update: {
          created_at?: string
          data_entrada?: string
          fornecedor_id?: string | null
          id?: string
          numero_nota?: string | null
          observacoes?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_entrada_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_fiado: {
        Row: {
          caixa_id: string | null
          cliente_id: string
          created_at: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          observacoes: string | null
          valor: number
        }
        Insert: {
          caixa_id?: string | null
          cliente_id: string
          created_at?: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacoes?: string | null
          valor: number
        }
        Update: {
          caixa_id?: string | null
          cliente_id?: string
          created_at?: string
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacoes?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_fiado_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_fiado_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string | null
          codigo_barras: string | null
          created_at: string
          descricao: string | null
          estoque_atual: number
          estoque_minimo: number
          fornecedor_id: string | null
          id: string
          nome: string
          preco_custo: number
          preco_venda: number
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          codigo_barras?: string | null
          created_at?: string
          descricao?: string | null
          estoque_atual?: number
          estoque_minimo?: number
          fornecedor_id?: string | null
          id?: string
          nome: string
          preco_custo?: number
          preco_venda?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          codigo_barras?: string | null
          created_at?: string
          descricao?: string | null
          estoque_atual?: number
          estoque_minimo?: number
          fornecedor_id?: string | null
          id?: string
          nome?: string
          preco_custo?: number
          preco_venda?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          caixa_id: string | null
          cancelada: boolean
          cliente_id: string | null
          created_at: string
          desconto: number
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          numero_cupom: number
          observacoes: string | null
          subtotal: number
          total: number
          troco: number | null
          valor_recebido: number | null
        }
        Insert: {
          caixa_id?: string | null
          cancelada?: boolean
          cliente_id?: string | null
          created_at?: string
          desconto?: number
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          numero_cupom?: number
          observacoes?: string | null
          subtotal?: number
          total?: number
          troco?: number | null
          valor_recebido?: number | null
        }
        Update: {
          caixa_id?: string | null
          cancelada?: boolean
          cliente_id?: string | null
          created_at?: string
          desconto?: number
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          numero_cupom?: number
          observacoes?: string | null
          subtotal?: number
          total?: number
          troco?: number | null
          valor_recebido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      caixa_aberto: { Args: never; Returns: string }
    }
    Enums: {
      forma_pagamento: "dinheiro" | "debito" | "credito" | "pix" | "fiado"
      movimentacao_motivo:
        | "compra"
        | "venda"
        | "troca"
        | "vencido"
        | "roubo"
        | "depreciacao"
        | "furo_estoque"
        | "outro"
      movimentacao_tipo:
        | "entrada_compra"
        | "saida_venda"
        | "saida_troca"
        | "saida_perda"
        | "ajuste"
      tipo_mov_caixa:
        | "abertura"
        | "sangria"
        | "suprimento"
        | "despesa"
        | "venda"
        | "recebimento_fiado"
        | "fechamento"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      forma_pagamento: ["dinheiro", "debito", "credito", "pix", "fiado"],
      movimentacao_motivo: [
        "compra",
        "venda",
        "troca",
        "vencido",
        "roubo",
        "depreciacao",
        "furo_estoque",
        "outro",
      ],
      movimentacao_tipo: [
        "entrada_compra",
        "saida_venda",
        "saida_troca",
        "saida_perda",
        "ajuste",
      ],
      tipo_mov_caixa: [
        "abertura",
        "sangria",
        "suprimento",
        "despesa",
        "venda",
        "recebimento_fiado",
        "fechamento",
      ],
    },
  },
} as const
